/// <reference path="../../.ref/js/santedb.js" />

angular.module('santedb').controller('EmrPatientRegisterController', ["$scope", "$rootScope", "$state", "$transitions", "$interval", "$timeout", function ($scope, $rootScope, $state, $transitions, $interval, $timeout) {

    // Assign the scope functions
    $scope.cancelEdit = cancelEdit;
    $scope.registerPatient = registerPatient;
    
    // Initialize the view
    async function initializeView(tempalteId) {

        try {
            templateId = templateId || "org.santedb.patient";
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

    
    // Submit the form
    async function registerPatient(patientForm) {
        if (!patientForm.$valid) return;

        try {
            SanteDB.display.buttonWait("#btnSubmit", true);

            if (!$scope.entity.ignoreDuplicates) {
                var duplicates = await checkDuplicates();
                if (duplicates.totalResults > 0) {
                    $timeout(() => {
                        $scope.duplicates = duplicates;
                        $("#duplicateModal").modal();
                    });
                    return;
                }
            }
            else {
                $("#duplicateModal").modal('hide');
            }

            // Submission object
            var patient = new Patient(angular.copy($scope.entity));
            patient.id = SanteDB.application.newGuid();
            // Create a submission bundle with related entities
            var bundle = await bundleRelatedObjects(patient);

            await SanteDB.resources.bundle.insertAsync(bundle);
            $state.transitionTo("santedb-emr.patient.view", { id: patient.id });
            toastr.success(SanteDB.locale.getString("ui.emr.patient.register.success"));
        }
        catch (e) {
            $rootScope.errorHandler(e);
        }
        finally {
            SanteDB.display.buttonWait("#btnSubmit", false);
        }
    }


    $scope.resetView = async function () {
        await initializeView();
    }

    // No template use the default
    var templateId = $state.templateId;
    if (!templateId) {
        templateId = SanteDB.configuration.getAppSetting("template.patient") || "org.santedb.emr.patient";
    }
    
    initializeView(templateId);

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
