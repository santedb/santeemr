/// <reference path="../../.ref/js/santedb.js" />

angular.module('santedb').controller('EmrPatientRegisterController', ["$scope", "$rootScope", "$state", "$transitions", "$interval", "$timeout", function ($scope, $rootScope, $state, $transitions, $interval, $timeout) {

    // Assign the scope functions
    $scope.cancelEdit = cancelEdit;
    $scope.registerPatient = registerPatient;
    
    // Initialize the view
    async function initializeView() {

        try {
            $scope.templates = await SanteDB.application.getTemplateDefinitionsAsync({ "scope": "org.santedb.patient" });
            $scope._entityTemplate = await SanteDB.application.getTemplateContentAsync(templateId);
            $scope.entity = angular.copy($scope._entityTemplate);
        }
        catch (e) {
            $rootScope.errorHandler(e);
        }
    }

    // Check for duplicates
    async function checkDuplicates(page) {
        try {

            page = page || 0;
            // First, are there duplicates that need to be considered? 
            // We will search by an identifier if possible
            var duplicateQuery = {};
            if ($scope.entity.identifier)
                Object.keys($scope.entity.identifier).forEach(function (key) {
                    if ($scope.entity.identifier[key].value)
                        duplicateQuery[`identifier[${key}].value`] = $scope.entity.identifier[key].value;
                });
            if(Object.keys(duplicateQuery).length == 0) {
                if ($scope.entity.name)
                    Object.keys($scope.entity.name).forEach(function (nameType) {

                        if (!Array.isArray($scope.entity.name[nameType]))
                            $scope.entity.name[nameType] = [$scope.entity.name[nameType]];

                        $scope.entity.name[nameType].forEach(function (name) {
                            if (name.component) {
                                Object.keys(name.component).forEach(function (componentType) {
                                    if (nameType == "$other")
                                        duplicateQuery[`name.component[${componentType}].value`] = `:(approx|${name.component[componentType]})`; //`:(approx|"${name.component[componentType]}")`;
                                    else
                                        duplicateQuery[`name[${nameType}].component[${componentType}].value`] = `:(approx|"${name.component[componentType]}")`;
                                });
                            }
                        });
                    });
                if ($scope.entity.address)
                    Object.keys($scope.entity.address).forEach(function (addressType) {

                        if (addressType != "County" && addressType != "State" && addressType != "City")
                            return;

                        if (!Array.isArray($scope.entity.address[addressType]))
                            $scope.entity.address[addressType] = [$scope.entity.address[addressType]];

                        $scope.entity.address[addressType].forEach(function (address) {
                            if (address.component) {
                                Object.keys(address.component).forEach(function (componentType) {
                                    if (addressType == "$other")
                                        duplicateQuery[`address.component[${componentType}].value`] = `${address.component[componentType]}`; //`:(approx|"${name.component[componentType]}")`;
                                    else
                                        duplicateQuery[`address[${addressType}].component[${componentType}].value`] = `${address.component[componentType]})`;
                                });
                            }
                        });
                    });
                // Set gender and age on duplicate query
                duplicateQuery["genderConcept"] = $scope.entity.genderConceptModel.id;
                duplicateQuery["dateOfBirth"] = `:(date_diff|${SanteDB.display.renderDate($scope.entity.dateOfBirth, $scope.entity.dateOfBirthPrecision)})<1y`;
            }
            duplicateQuery["_offset"] = (page || 0) * 3;
            duplicateQuery["_count"] = 3;
            // Check for duplicates 
            var duplicates = await SanteDB.resources.patient.findAsync(duplicateQuery);
            duplicates.pages = Math.round(duplicates.totalResults / 3);
            if (duplicates.pages * 3 < duplicates.totalResults)
                duplicates.pages++;
            if(duplicates.pages > 5)
                duplicates.pages = 5;
            duplicates.page = page;
            return duplicates;

        }
        catch (e) {
            $rootScope.errorHandler(e);
        }
    }

    
    // Submit the form
    async function registerPatient(patientForm, bulkEntry) {
        if (!patientForm.$valid) return;

        try {
            SanteDB.display.buttonWait("#btnSubmit", true);

            if (!$scope.entity.ignoreDuplicates) {
                var duplicates = await checkDuplicates();
                if (duplicates.totalResults > 0) {
                    $scope.duplicates = duplicates;
                    $("#duplicateModal").modal();
                    return;
                }
            }
            else
                $("#duplicateModal").modal('hide');

            // Submission object
            var patient = new Patient(angular.copy($scope.entity));
            patient.id = SanteDB.application.newGuid();

            patient = await prepareEntityForSubmission(patient);
            scrubModelProperties(patient);

            // Create a submission bundle with related entities
            var bundle = new Bundle({ resource: [patient] })

            if (patient.relationship) {

                // Iterate over relationship types
                var correctedRelationship = {};
                await Promise.all(Object.keys(patient.relationship).map(async function (relationshipType) {

                    // Fetch and correct
                    var relationships = patient.relationship[relationshipType];
                    if (!Array.isArray(relationships))
                        relationships = [relationships];

                    value = await Promise.all(relationships
                        .filter(o => o && (o._active && o.targetModel || !o.targetModel))
                        .map(async function (rel) {
                            if (rel.targetModel) {
                                var entity = angular.copy(rel.targetModel);
                                rel.target = entity.id = SanteDB.application.newGuid();
                                entity = await prepareEntityForSubmission(entity);
                                bundle.resource.push(entity);
                                delete (rel.targetModel);
                            }
                            rel.holder = patient.id;
                            return rel;
                        }));

                    if (value.length > 0)
                        correctedRelationship[relationshipType] = value;
                }));
                patient.relationship = correctedRelationship;
            }


            if (!bulkEntry) {
                var bundleResult = await SanteDB.resources.bundle.insertAsync(bundle);
                $scope.entity.id = patient.id;
                $state.transitionTo("santedb-emr.patient.view", { id: patient.id });
            }
            else {
                
                var hist = { entity: patient, bundle: bundle };
                $scope.submitBatch(hist);
                $scope.registerHistory.push(hist);

                $scope.entity = angular.copy($scope._entityTemplate);
                $($(".form-control", "#editForm")[0]).focus();
            }
        }
        catch (e) {
            $rootScope.errorHandler(e);
        }
        finally {
            SanteDB.display.buttonWait("#btnSubmit", false);
            try {
                $scope.$apply();
            }
            catch (e2) { } // Ignore scope apply updates
        }
    }


    // Check for duplicates bound onto the scope
    $scope.checkDuplicates = async function (page) {
        try {
         var duplicates = await checkDuplicates(page);
         $timeout(()=>$scope.duplicates = duplicates);
        }
        catch(e) {
            $rootScope.errorHandler(e);
        }
    }

    $scope.resetView = async function () {
        await initializeView();
        try {
            $scope.$apply();
        } catch (e) { }
    }

    $scope.registerHistory = [];

    // No template use the default
    var templateId = $state.templateId;
    if (!templateId) {
        templateId = SanteDB.configuration.getAppSetting("template.patient") || "org.santedb.emr.patient";
    }
    
    initializeView().then(function () { $scope.$apply(); });

    $scope.submitBatch = async function(hist) {

        try {
            hist._batchState = 0;
            hist._batchStateText = SanteDB.locale.getString("ui.wait");
            
            await SanteDB.resources.bundle.insertAsync(hist.bundle);

            hist._batchStateText = SanteDB.locale.getString("ui.model.patient.saveSuccess");

            delete hist.bundle;
            hist._batchState = 1;
                
            try {
                var rpid = await SanteDB.resources.patient.getAsync(hist.entity.id);
            }
            catch(e) {
                if(e.$type == "FileNotFoundException")
                hist._batchState = 3;
                else {
                    hist._batchStateText = e.message;
                }
            }
        }
        catch(e) {
            hist._batchState = 2;
            hist._batchStateText = e.message;
        }
    }

    // Cancel submission
    function cancelEdit() {
        window.history.back();
    }

    // Confirm navigation away in browser
    window.onbeforeunload = function () {
        window.onbeforeunload = null;
        var form = angular.element("#editForm").scope().editForm;
        return !form.$pristine;
    }
}]);
