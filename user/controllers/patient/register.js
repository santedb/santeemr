/// <reference path="../../.ref/js/santedb.js" />

// Get unique identifiers on load 
angular.module('santedb').controller('EmrPatientRegisterController', ["$scope", "$rootScope", "$state", "$transitions", "$interval", "$timeout", function ($scope, $rootScope, $state, $transitions, $interval, $timeout) {


    const IGNORE_RELATIONSHIP = [
        "ServiceDeliveryLocation",
        "DedicatedServiceDeliveryLocation",
        "IncidentalServiceDeliveryLocation"
    ];

    // No template use the default
    var templateId = $state.templateId;

    if (!templateId) {
        templateId = SanteDB.configuration.getAppSetting("template.patient") || "org.santedb.emr.patient";
    }

    // Initialize the view
    async function initializeView(templateId) {

        try {
            templateId = templateId || "org.santedb.emr.patient";
            var _entityTemplate = await SanteDB.application.getTemplateContentAsync(templateId);
            $timeout(() => {
                $scope.entity = angular.copy(_entityTemplate);
                $scope.entity.$otherData = [];
            });
            

        }
        catch (e) {
            $rootScope.errorHandler(e);
        }
    }

    $scope.resetView = async function () {
        await initializeView(templateId);
    }

    initializeView(templateId);

    var validateInterval = $interval(detectDataQualityIssues, 2000);

    // Confirm navigation away in browser
    window.onbeforeunload = function () {
        var form = angular.element("#editForm").scope().editForm;
        return !form.$pristine;
    }

    // unbind the nav away
    $scope.$on("$destroy", function (s) {
        window.onbeforeunload = null;
        $interval.cancel(validateInterval);
    });

    // When the home address changes - automatically apply the default for selected facility
    $scope.$watch((scope) => scope.entity ? JSON.stringify(scope.entity.address.HomeAddress) : null, async function (n, o) {
        if (n && n != o) {
            try {
                if ($scope.entity.address.HomeAddress[0].component &&
                    $scope.entity.address.HomeAddress[0].component._AddressPlaceRef &&
                    $scope.entity.address.HomeAddress[0].component._AddressPlaceRef.length
                ) {
                    var dsdl = await SanteDB.resources.place.findAsync({ "classConcept": EntityClassKeys.ServiceDeliveryLocation, "relationship[DedicatedServiceDeliveryLocation].source": $scope.entity.address.HomeAddress[0].component._AddressPlaceRef, _count: 1, _includeTotal: true });
                    if (dsdl.totalResults == 1) // one result!
                    {
                        $timeout(() => {
                            $scope.entity.relationship.DedicatedServiceDeliveryLocation[0].target = dsdl.resource[0].id;
                        });
                    }
                }
            }
            catch (e) {
                console.warn(e);
            }
        }
    });


    async function detectDataQualityIssues() {
        if(!$scope.entity || !$scope.entity.$type) { 
            return;
        }

        var dataQuality = await SanteDB.resources.patient.invokeOperationAsync(null, "validate", { target: $scope.entity });
        var registrationForm = angular.element("#editForm").scope().editForm;
        // Clear all DQ issues
        Object.keys(registrationForm).filter(k => !k.startsWith("$")).forEach(k => {
            if (registrationForm[k] && registrationForm[k].$error && registrationForm[k].$error['dq']) {
                registrationForm[k].$setValidity("dq", true);
            }
        });


        $timeout(() => {
            registrationForm.dataQualityIssues = null;
            if (dataQuality && dataQuality.length > 0) {
                registrationForm.dataQualityIssues = {};
                dataQuality.forEach(err => {
                    var dqTarget = err.id.substring(0, err.id.indexOf('.'));
                    var targetName = $(`[data-quality-id='${dqTarget}']`).attr("name");
                    if (targetName) {
                        registrationForm.dataQualityIssues[dqTarget] = err;

                        if (err.priority == "Error" && registrationForm[targetName]) {
                            registrationForm[targetName].$setValidity("dq", false);
                        }
                        else {
                            err.dismiss = function () {
                                delete (registrationForm.dataQualityIssues[dqTarget]);

                                if (registrationForm[targetName]) {
                                    registrationForm[targetName].$setValidity("dq", true);
                                }
                                if (Object.keys(registrationForm.dataQualityIssues) == 0) {
                                    registrationForm.dataQualityIssues = {};
                                    registrationForm._ignoreDataQualityIssues = true;
                                }
                            }
                        }
                        err.goTo = function () {
                            $(`[name=${targetName}]`).focus();
                        }
                    }
                    else {
                        registrationForm.dataQualityIssues[dqTarget] = err;
                    }
                });
            }
        });

    }

    // Register the patient
    $scope.registerPatient = async function (registrationForm) {

        if (registrationForm.$invalid || registrationForm.dataQualityIssues && !confirm(SanteDB.locale.getString("ui.emr.patient.register.dataQuality.ignoreConfirm"))) {
            return;
        }

        try {
            SanteDB.display.buttonWait("#btnSubmit", true);
            var submissionBundle = new Bundle({ resource: [] });
            // First we want to strip off dependent objects
            var patient = new Patient(angular.copy($scope.entity));
            patient.id = patient.id || SanteDB.application.newGuid();

            // Target models should be moved to the bundle
            Object.keys(patient.relationship).filter(o => IGNORE_RELATIONSHIP.indexOf(o) == -1).forEach(key => {
                var relationship = patient.relationship[key];
                relationship.filter(rel => rel.relationshipType && rel.targetModel && rel.targetModel.operation !== BatchOperationType.Delete && 
                    (rel.targetModel.$type != "Person" || rel.targetModel.dateOfBirth)
                )
                    .forEach(rel => {                        
                        submissionBundle.resource.push(rel.targetModel);
                        rel.target = rel.targetModel.id = rel.targetModel.id || rel.target || SanteDB.application.newGuid();

                        // If the target model is a Person with same address we want to copy 
                        if (rel.targetModel.address &&
                            rel.targetModel.address.HomeAddress[0] &&
                            !rel.targetModel.address.HomeAddress[0]._differentThanPatient
                        ) {
                            rel.targetModel.address.HomeAddress = angular.copy(patient.address.HomeAddress);
                        }
                        delete rel.targetModel;
                    });
                patient.relationship[key] = relationship.filter(o=>o.target);
            });

            // Any relationships under $other are moved 
            for (var i = patient.relationship.$other.length - 1; i >= 0; i--) {
                if (!patient.relationship.$other[i].relationshipType && !patient.relationship.$other[i].id) {
                    patient.relationship.$other.splice(i, 1);
                }
                if (i > 0) {
                    submissionBundle.resource.push(patient.relationship.$other[i]);
                    delete (patient.relationship.$other[i]);
                }
            }

            // Push any other data
            if($scope.entity.$otherData) {
                $scope.entity.$otherData.forEach(d=>submissionBundle.resource.push(d)); 
            }

            // Next we want to submit the registration
            var registrationAct = new Act({
                id: SanteDB.application.newGuid(),
                classConcept: ActClassKeys.Registration,
                actTime: new Date(),
                moodConcept: ActMoodKeys.Eventoccurrence,
                typeConcept: ADT_REGISTRATION_TYPES.ADMIT,
                participation: {
                    RecordTarget: [
                        {
                            player: patient.id
                        }
                    ],
                    Location: [
                        {
                            player: await SanteDB.authentication.getCurrentFacilityId()
                        }
                    ],
                    Authororiginator: [
                        {
                            player: await SanteDB.authentication.getCurrentUserEntityId()
                        }
                    ]
                }
            });

            // Move all participations to the ACT
            if(patient.participation && patient.participation.RecordTarget) {
                registrationAct.relationship = {
                    Documents: patient.participation.RecordTarget.filter(o=>o.actModel).map(o => {
                        if(o.actModel) 
                        {
                            o.act = o.actModel.id = o.actModel.id || SanteDB.application.newGuid();
                            submissionBundle.resource.push(o.actModel);
                            delete(o.actModel);
                        }
                        return new ActRelationship({
                            target: o.act
                        });
                    })
                };
                delete patient.participation;
            }
            patient = await prepareEntityForSubmission(patient);
            patient = scrubModelProperties(patient);


            //patient.creationAct = registrationAct.id;
            submissionBundle.resource.push(registrationAct);
            submissionBundle.resource.push(patient);

            // Check for duplicates 
            console.info("Checking for duplicates");
            if (!$scope.entity._ignoreDuplicates) {
                var duplicates = await SanteDB.resources.patient.invokeOperationAsync(null, "match", { target: patient });
                if (duplicates.results && duplicates.results != null) {
                    $timeout(() => {
                        $scope.detectedDuplicates = duplicates.results;
                        $("#registrationDuplicatesModal").modal('show');
                    });
                    return;
                }
            }

            var submissionResult = await SanteDB.resources.bundle.insertAsync(submissionBundle);
            toastr.success(SanteDB.locale.getString("ui.emr.patient.register.success"));

            if ($scope.entity.$then == "another") {
                await initializeView();
                $("input")[0].focus();
            }
            else {
                SanteDB.application.getResourceViewer("Patient")[0]($state, { id: patient.id }); // Nav to the patient view screen
            }
        }
        catch (e) {
            $rootScope.errorHandler(e);
        }
        finally {
            SanteDB.display.buttonWait("#btnSubmit", false);
        }

    }
}])
    // CONTROLLER -> Generic functions for registration widgets (note: should not $watch or initialize data)
    .controller("EmrPatientRegisterWidgetController", ["$scope", "$rootScope", "$timeout", function ($scope, $rootScope, $timeout) {

        var originalRelationshipData = {};
        $scope.ageToDate = ageToDate;
        $scope.dateToAge = dateToAge;

        async function lookupRelative(relativeType, identifierList) {
            try {

                var filter = {
                    _includeTotal: true,
                    _count: 1
                };

                Object.keys(identifierList).filter(o => $rootScope.system.uniqueDomains.indexOf(o) > -1).forEach(o => {
                    var identifiers = identifierList[o].filter(id => id.value && id.value != "");
                    if (identifiers.length > 0) {
                        filter[`identifier[${o}].value`] = identifiers.map(o => o.value);
                    }
                });

                if (Object.keys(filter).length > 2) {
                    var matches = await SanteDB.resources.person.findAsync(filter, "full");
                    switch(matches.totalResults) 
                    {
                        case 0:
                            var relative = $scope.scopedObject.relationship[relativeType][0].targetModel;
                            if(relative._populatedViaMatch) // We previously set this from a match
                            {
                                $timeout(() => {
                                    $scope.scopedObject.relationship[relativeType][0].targetModel = originalRelationshipData[relativeType];
                                    $scope.scopedObject.relationship[relativeType][0].targetModel.identifier = identifierList;
                                });
                            }
                            break;
                        case 1:
                            $timeout(() => {
                                originalRelationshipData[relativeType] = $scope.scopedObject.relationship[relativeType][0].targetModel;

                                var person = new Person(matches.resource[0]);
                                $scope.scopedObject.relationship[relativeType][0].targetModel = person; // Copy the information from the other relative
                                person.identifier = identifierList;
                                person._populatedViaMatch = true;
                                if (person.dateOfBirthPrecision == 1) {
                                    person.age = dateToAge(person.dateOfBirth);
                                }
                                if (person.address &&
                                    person.address.HomeAddress) {
                                    person.address.HomeAddress[0]._differentThanPatient = true;
                                }
                            });
                            break;
                        default:
                            toastr.warning(SanteDB.locale.getString("ui.emr.patient.register.relative.multipleMatches", { relativeType: relativeType }));
                    }
                }
            }
            catch (e) {
                toastr.warning(SanteDB.locale.getString("ui.emr.patient.register.relative.errorSearching", { error: e.message }));
            }
        }

        switch ($scope.panel.name) {
            case "org.santedb.emr.widget.patient.register.mother":
                $scope.$watch(scope => JSON.stringify(scope.scopedObject.relationship.Mother[0].targetModel.identifier), function (n, o) {
                    if (n && n != o) {
                        lookupRelative("Mother", $scope.scopedObject.relationship.Mother[0].targetModel.identifier);
                    }
                });

                break;
            case "org.santedb.emr.widget.patient.register.relatives":
                $scope.$watch(scope => JSON.stringify(scope.scopedObject.relationship.$other[0].targetModel.identifier), function (n, o) {
                    if (n && n != o) {
                        lookupRelative("$other", $scope.scopedObject.relationship.$other[0].targetModel.identifier);
                    }
                });
                break;
            case "org.santedb.emr.widget.patient.register.identifier":
                $scope.$watch(scope => scope.scopedObject.identifier ? Object.keys(scope.scopedObject.identifier).map(k => `${k}:${scope.scopedObject.identifier[k].map(i=>i.value).join(";")}`).join(",") : ";", async function (n, o) {
                    if (n && o && n != o) {
                        try {
                            var filter = {
                                _includeTotal: true,
                                _count: 1
                            };

                            identifierList = $scope.scopedObject.identifier;

                            // Clear any duplicate errors
                            if ($rootScope.system && $rootScope.system.uniqueDomains) {
                                $timeout(() =>
                                    $rootScope.system.uniqueDomains.map(uqd => `patientIdentifierid${uqd}0`)
                                        .filter(uqd => $scope.panel.editForm[uqd])
                                        .forEach(uqd => $scope.panel.editForm[uqd].$setValidity("duplicate", true))
                                );
                            }

                            var duplicatedDomains = [];
                            Object.keys($scope.scopedObject.identifier).filter(f => $rootScope.system.uniqueDomains.indexOf(f) > -1).forEach(f => {
                                var identifiers = identifierList[f].filter(id => id.value && id.value != "");
                                if (identifiers.length > 0) {
                                    filter[`identifier[${f}].value`] = identifiers.map(id => id.value);
                                    duplicatedDomains.push(f);
                                }
                            });

                            // TODO: Validate the behavior here
                            var alerts = [];
                            if (Object.keys(filter).length > 2) {
                                var duplicates = await SanteDB.resources.person.findAsync(filter, "full");
                                switch (duplicates.totalResults) {
                                    case 0: // No matches
                                        break;
                                    case 1: // Exactly one 
                                        if (duplicates.resource[0].$type == "Person") // The duplicate is a person - so we'll be linking them
                                        {
                                            toastr.info(SanteDB.locale.getString("ui.emr.patient.register.upgradePerson"));
                                            var dup = duplicates.resource[0];

                                            // All references to this person will also need to be corrected to this object
                                            var reverseReferences = await SanteDB.resources.entityRelationship.findAsync({ target: dup.id });
                                            
                                            $timeout(() => {
                                                SanteDB.application.copyValues($scope.scopedObject, dup);
                                                $scope.scopedObject.classConcept = EntityClassKeys.Patient;
                                                $scope.scopedObject.id = SanteDB.application.newGuid();
                                                $scope.scopedObject.age = dateToAge($scope.scopedObject.dateOfBirth);

                                                $scope.scopedObject.$otherData = [];
                                                $scope.scopedObject.$otherData.push(
                                                    new EntityRelationship(
                                                    {
                                                        target: dup.id,
                                                        relationshipType: EntityRelationshipTypeKeys.Replaces,
                                                        source: $scope.scopedObject.id
                                                    })
                                                );

                                                Object.keys(dup.identifier).filter(f => $rootScope.system.uniqueDomains.indexOf(f) > -1).forEach(key => {
                                                    dup.identifier[key].forEach(id => {
                                                        $scope.scopedObject.$otherData.push(new EntityIdentifier({
                                                            id: id.id,
                                                            operation: BatchOperationType.Delete
                                                        }));
                                                    });
                                                });
                                                $scope.scopedObject.$otherData.push(
                                                    new Person({
                                                        id: dup.id, 
                                                        statusConcept: StatusKeys.Obsolete
                                                    })
                                                );

                                                // Copy any relationships
                                                if (dup.relationship) {
                                                    Object.keys(dup.relationship).forEach(rel => {
                                                        var dupRel = dup.relationship[rel];
                                                        scopedObject.relationship[rel] = dupRel.map(drel =>
                                                            new EntityRelationship({
                                                                target: drel.target,
                                                                targetModel: drel.targetModel,
                                                                relationshipType: drel.relationshipType,
                                                                classification: drel.classification,
                                                                externId: drel.externId,
                                                                relationshipRole: drel.relationshipRole
                                                            })
                                                        )
                                                    });
                                                }

                                                // Redirect any further references 
                                                if (reverseReferences.resource) {
                                                    reverseReferences.resource.forEach(res => {
                                                        // Delete the old relationship
                                                        $scope.scopedObject.$otherData.push(new EntityRelationship({
                                                            id: res.id,
                                                            operation: BatchOperationType.Delete
                                                        }));
                                                        // Add a new relationship between the old data and the new data
                                                        $scope.scopedObject.$otherData.push(new EntityRelationship({
                                                            source: res.source,
                                                            holder: res.holder,
                                                            target: $scope.scopedObject.id,
                                                            relationshipType: res.relationshipType,
                                                            relationshipRole: res.relationshipRole
                                                        }));
                                                    });
                                                }
                                            });
                                        }
                                        else {
                                            toastr.warning(SanteDB.locale.getString("ui.emr.patient.register.duplicateDetected"));
                                            $timeout(() => duplicatedDomains.forEach(uqd => $scope.panel.editForm[`patientIdentifierid${uqd}0`].$setValidity("duplicate", false)));
                                        }
                                        break;
                                    default:
                                        {
                                            toastr.warning(SanteDB.locale.getString("ui.emr.patient.register.duplicateDetected"));
                                            $timeout(() => duplicatedDomains.forEach(uqd => $scope.panel.editForm[`patientIdentifierid${uqd}0`].$setValidity("duplicate", false)));
                                        }
                                }
                            }
                        }
                        catch (e) {
                            toastr.warning(SanteDB.locale.getString("ui.emr.patient.register.duplicate.errorSearching", { error: e.message }));
                        }
                    }
                })
                break;
        }

    }])
