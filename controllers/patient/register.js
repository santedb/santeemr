/// <reference path="../../.ref/js/santedb.js" />

angular.module('santedb').controller('EmrPatientRegisterController', ["$scope", "$rootScope", "$state", "$transitions", "$interval", function ($scope, $rootScope, $state, $transitions, $interval) {

    // Assign the scope functions
    $scope.cancelEdit = cancelEdit;
    $scope.registerPatient = registerPatient;
    $scope.checkDuplicates = async function(page) {
        $scope.duplicates = await checkDuplicates(page);
        $scope.$apply();
    }


    // No template use the default
    var templateId = $state.templateId;
    if (!templateId) {
        templateId = SanteDB.configuration.getAppSetting("template.patient") || "org.santedb.emr.patient";
    }

    // Synchronize ages of object
    function synchronizeAge(modelObject, fromDate) {

        if (modelObject.dateOfBirth && fromDate)
            modelObject.age = moment().diff(modelObject.dateOfBirth, 'years', false);
        else {
            modelObject.dateOfBirth = moment().subtract({ years: modelObject.age }).toDate();
            modelObject.dateOfBirthPrecision = 1;
        }
    }

    // Initialize the view
    async function initializeView() {

        try {
            $scope.templates = await SanteDB.application.getTemplateDefinitionsAsync({ "scope": "org.santedb.patient" });
            $scope.patient = await SanteDB.application.getTemplateContentAsync(templateId);
            // Watchers
            $scope.$watch("patient.dateOfBirth", function (n, o) {
                if (n && n != o)
                    synchronizeAge($scope.patient, true);
            });
            $scope.$watch("patient.age", function (n, o) {
                if (n && n != o)
                    synchronizeAge($scope.patient);
            });

        }
        catch (e) {
            $rootScope.errorHandler(e);
        }
    }
    initializeView().then(function () { $scope.$apply(); });

    // Check for duplicates
    async function checkDuplicates(page) {
        try {

            page = page || 0;
            // First, are there duplicates that need to be considered? 
            // We will search by an identifier if possible
            var duplicateQuery = {};
            if ($scope.patient.identifier)
                Object.keys($scope.patient.identifier).forEach(function (key) {
                    if ($scope.patient.identifier[key].value)
                        duplicateQuery[`identifier[${key}].value`] = $scope.patient.identifier[key].value;
                });
            if ($scope.patient.name)
                Object.keys($scope.patient.name).forEach(function (nameType) {

                    if (!Array.isArray($scope.patient.name[nameType]))
                        $scope.patient.name[nameType] = [$scope.patient.name[nameType]];

                    $scope.patient.name[nameType].forEach(function (name) {
                        if (name.component) {
                            Object.keys(name.component).forEach(function (componentType) {
                                if (nameType == "$other")
                                    duplicateQuery[`name.component[${componentType}].value`] = `~${name.component[componentType]}`; //`:(approx|"${name.component[componentType]}")`;
                                else
                                    duplicateQuery[`name[${nameType}].component[${componentType}].value`] = `:(approx|"${name.component[componentType]}")`;
                            });
                        }
                    });
                });

            // Set gender and age on duplicate query
            duplicateQuery["genderConcept"] = $scope.patient.genderConceptModel.id;
            duplicateQuery["dateOfBirth"] = SanteDB.display.renderDate($scope.patient.dateOfBirth, $scope.patient.dateOfBirthPrecision);
            duplicateQuery["_offset"] = (page || 0) * 3;
            duplicateQuery["_count"] = 3;
            // Check for duplicates 
            var duplicates = await SanteDB.resources.patient.findAsync(duplicateQuery);
            duplicates.pages = Math.round(duplicates.totalResults / 3);
            if(duplicates.pages * 3 < duplicates.totalResults)
                duplicates.pages++;
            duplicates.page = page;
            return duplicates;
        
        }
        catch (e) {
            $rootScope.errorHandler(e);
        }
    }

    
    // Submit the form
    async function registerPatient(patientForm) {
        if (!patientForm.$valid) return;

        try {
            SanteDB.display.buttonWait("#btnSubmit", true);

            if (!$scope.patient.ignoreDuplicates)
            {
                var duplicates = await checkDuplicates();
                if(duplicates.totalResults > 0) {
                    $scope.duplicates = duplicates;
                    $("#duplicateModal").modal();
                    return ;
                }
            }

            // Submission object
            var patient = new Patient(angular.copy($scope.patient));
            patient.id = SanteDB.application.newGuid();
            patient.genderConcept = patient.genderConceptModel.id;
            delete(patient.genderConceptModel);

            await correctEntityInformation(patient);

            // Create a submission bundle with related entities
            var bundle = new Bundle({ resource: [ patient ]})

            if(patient.relationship) {

                // Iterate over relationship types
                var correctedRelationship = {};
                Object.keys(patient.relationship).map(function(relationshipType) {

                    // Fetch and correct
                    var relationships = patient.relationship[relationshipType];
                    if(!Array.isArray(relationships))
                        relationships = [relationships];

                    var value = relationships
                        .filter(o=>o && (o._active && o.targetModel || !o.targetModel))
                        .map(function(rel) {
                            if(rel.targetModel) {
                                var entity = angular.copy(rel.targetModel);
                                rel.target = entity.id = SanteDB.application.newGuid();
                                correctEntityInformation(entity);
                                bundle.resource.push(entity);
                                delete(rel.targetModel);
                            }
                            rel.holder = patient.id;
                            return rel;
                        });
                    
                    if(value.length > 0)
                        correctedRelationship[relationshipType] = value;
                });
                patient.relationship = correctedRelationship;
            }

            var bundleResult = await SanteDB.resources.bundle.insertAsync(bundle);
            $scope.patient.id = patient.id;
            // Navigate
            $state.transitionTo("santedb-emr.patient.view", {id: patient.id});
        }
        catch (e) {
            $rootScope.errorHandler(e);
        }
        finally {
            SanteDB.display.buttonWait("#btnSubmit", false);
            try {
                $scope.$apply();
            }
            catch(e2) {} // Ignore scope apply updates
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
