/// <reference path="../../.ref/js/santedb.js" />

// Get unique identifiers on load 
angular.module('santedb').controller('EmrPatientRegisterController', ["$scope", "$rootScope", "$state", "$transitions", "$interval", "$timeout", function ($scope, $rootScope, $state, $transitions, $interval, $timeout) {


    // No template use the default
    var templateId = $state.templateId;
    if (!templateId) {
        templateId = SanteDB.configuration.getAppSetting("template.patient") || "org.santedb.emr.patient";
    }

    // Initialize the view
    async function initializeView(tempalteId) {

        try {
            templateId = templateId || "org.santedb.emr.patient";
            var _entityTemplate = await SanteDB.application.getTemplateContentAsync(templateId);
            $timeout(() => $scope.entity = angular.copy(_entityTemplate));
        }
        catch (e) {
            $rootScope.errorHandler(e);
        }
    }

    // Check for duplicates
    async function checkDuplicates(patient) {
        try {
            // TODO: Invoke the $match operation
        }
        catch (e) {
            $rootScope.errorHandler(e);
        }
    }

    $scope.resetView = async function () {
        await initializeView(templateId);
    }

    initializeView(templateId);

    // Confirm navigation away in browser
    window.onbeforeunload = function () {
        var form = angular.element("#editForm").scope().editForm;
        return !form.$pristine;
    }

    // unbind the nav away
    $scope.$on("$destroy", function (s) {
        window.onbeforeunload = null;
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

    // Register the patient
    $scope.registerPatient = async function(registrationForm) {
        if(registrationForm.$invalid) {
            return;
        }

        try {
            SanteDB.display.buttonWait("#btnSubmit", true);
            var submissionBundle = new Bundle({ resource: [] });
            // First we want to strip off dependent objects
            var patient = angular.copy($scope.entity);
            
            // Target models should be moved to the bundle
            Object.keys(patient.relationship).forEach(key => {
                var relationship = patient.relationship[key];
                relationship.filter(rel=>rel.relationshipType && rel.targetModel && rel.targetModel.operation !== BatchOperationType.Delete).forEach(rel => {
                    submissionBundle.resource.push(rel.targetModel); 
                    rel.target = rel.targetModel.id = rel.targetModel.id || rel.target || SanteDB.application.newGuid();

                    // If the target model is a Person with same address we want to copy 
                    if(rel.targetModel.address && 
                        rel.targetModel.address.HomeAddress[0] &&
                        !rel.targetModel.address.HomeAddress[0]._differentThanPatient
                    ) {
                        rel.targetModel.address.HomeAddress = patient.address.HomeAddress;
                    }
                    delete rel.targetModel;
                });
            });

            // Any relationships under $other are moved 
            for(var i = patient.relationship.$other.length - 1; i >= 0; i--) {
                if(!patient.relationship.$other[i].relationshipType)
                    {
                        patient.relationship.$other.splice(i, 1);
                    }
                if(i > 0) {
                    submissionBundle.resource.push(patient.relationship.$other[i]);
                    delete(patient.relationship.$other[i]);
                }
            }
            patient = await prepareEntityForSubmission(patient);
            submissionBundle.resource.push(patient);

            console.info(submissionBundle);

            // Check for duplicates 
            console.info("Checking for duplicates");
            var duplicates = await SanteDB.resources.patient.invokeOperationAsync(null, "match", { target: patient  });
        }
        catch(e) {
            $rootScope.errorHandler(e);
        }
        finally {
            SanteDB.display.buttonWait("#btnSubmit", false);

        }

    }
}])
    // CONTROLLER -> Generic functions for registration widgets (note: should not $watch or initialize data)
    .controller("EmrPatientRegisterWidgetController", ["$scope", "$rootScope", "$timeout", function ($scope, $rootScope, $timeout) {

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
                    var matches = await SanteDB.resources.person.findAsync(filter, "min");
                    if (matches.totalResults == 1) {
                        $scope.scopedObject.relationship[relativeType][0] = new Person(matches.resource[0]); // Copy the information from the other relative
                        
                        if($scope.scopedObject.relationship[relativeType][0].address &&
                            $scope.scopedObject.relationship[relativeType][0].address.HomeAddress) {
                                $scope.scopedObject.relationship[relativeType][0].address.HomeAddress[0]._differentThanPatient = true;
                            }
                    }
                    else if (matches.totalResults > 1) {
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
                $scope.$watch(scope => JSON.stringify(scope.scopedObject.relationship.Mother[0].identifier), function (n, o) {
                    if (n && n != o) {
                        lookupRelative("Mother", $scope.scopedObject.relationship.Mother[0].identifier);
                    }
                });

                break;
            case "org.santedb.emr.widget.patient.register.relatives":
                $scope.$watch(scope => JSON.stringify(scope.scopedObject.relationship.$other[0].identifier), function (n, o) {
                    if (n && n != o) {
                        lookupRelative("$other", $scope.scopedObject.relationship.$other[0].identifier);
                    }
                });
                break;
            case "org.santedb.emr.widget.patient.register.identifier":
                $scope.$watch(scope => JSON.stringify(scope.scopedObject.identifier), async function (n, o) {
                    if (n && o && n != o) {
                        try {
                            var filter = {
                                _includeTotal: true,
                                _count: 1
                            };

                            identifierList = $scope.scopedObject.identifier;

                            // Clear any duplicate errors
                            $rootScope.system.uniqueDomains.map(uqd => `id${uqd}0`)
                                .filter(uqd => $scope.panel.editForm[uqd])
                                .forEach(uqd => $scope.panel.editForm[uqd].$setValidity("duplicate", true));

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
                                        if (duplicates.resource[0].$type == "Person") // The duplicate is a person - so we'll be upgrading them
                                        {
                                            toastr.info(SanteDB.locale.getString("ui.emr.patient.register.upgradePerson"));
                                            var dup = duplicates.resource[0];

                                            // All references to this person will also need to be corrected to this object
                                            var reverseReferences = await SanteDB.resources.entityRelationship.findAsync({ target: dup.id });

                                            $timeout(() => {
                                                $scope.scopedObject.id = SanteDB.application.newGuid();
                                                $scope.scopedObject.name = angular.copy(dup.name);
                                                $scope.scopedObject.address = angular.copy(dup.address);
                                                $scope.scopedObject.telecom = angular.copy(dup.telecom);
                                                $scope.scopedObject.identifier = angular.copy(dup.identifier);
                                                $scope.scopedObject.genderConcept = dup.genderConcept;
                                                $scope.scopedObject.dateOfBirth = dup.dateOfBirth;
                                                $scope.scopedObject.dateOfBirthPrecision = dup.dateOfBirthPrecision;
                                                $scope.scopedObject.relationship.Replaces = [
                                                    {
                                                        target: dup.id,
                                                        targetModel: new Person({
                                                            id: dup.id,
                                                            statusConcept: StatusKeys.Obsolete
                                                        })
                                                    }
                                                ];

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
                                                        $scope.scopedObject.relationship.$other.push(new EntityRelationship({
                                                            id: res.id,
                                                            operation: BatchOperationType.Delete
                                                        }));
                                                        // Add a new relationship between the old data and the new data
                                                        $scope.scopedObject.relationship.$other.push(new EntityRelationship({
                                                            source: res.source,
                                                            holder: res.holder,
                                                            target: $scope.scopedObject.id
                                                        }));
                                                    });
                                                }
                                            });
                                        }
                                        else {
                                            toastr.warning(SanteDB.locale.getString("ui.emr.patient.register.duplicateDetected"));
                                            duplicatedDomains.forEach(uqd => $scope.panel.editForm[`id${uqd}0`].$setValidity("duplicate", false));
                                        }
                                        break;
                                    default:
                                        {
                                            toastr.warning(SanteDB.locale.getString("ui.emr.patient.register.duplicateDetected"));
                                            duplicatedDomains.forEach(uqd => $scope.panel.editForm[`id${uqd}0`].$setValidity("duplicate", false));
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
