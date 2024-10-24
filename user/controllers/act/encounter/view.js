/// <reference path="../../../.ref/js/santedb.js" />
/// <reference path="../../../js/emr.js" />
angular.module('santedb').controller('EmrEncounterViewController', ["$scope", "$rootScope", "$timeout", "$state", "$stateParams", function ($scope, $rootScope, $timeout, $state, $stateParams) {

    async function initializeView(encounterId) {
        try {
            var encounter = await SanteDB.resources.patientEncounter.getAsync(encounterId, "full");

            // Resolve the tags on the encounter
            if(encounter.extension && encounter.extension[ENCOUNTER_FLOW.EXTENSION_URL]) {
                encounter.extension[ENCOUNTER_FLOW.EXTENSION_URL][0] = await SanteDB.application.resolveReferenceExtensionAsync(encounter.extension[ENCOUNTER_FLOW.EXTENSION_URL][0]);
            }

            // All participations are not touched
            if(encounter.relationship && encounter.relationship.HasComponent) {
                encounter.relationship.HasComponent.forEach(e=> e.operation = BatchOperationType.Ignore );
            }

            // TODO: Load the current act list and assign to the _HasComponent relationship
            $timeout(() => {
                $scope.encounter = encounter;
            });
        }
        catch(e) {
            // TODO: HANDLE ELEVATION CASE
            $rootScope.errorHandler(e);
        }
        finally {
            SanteDB.authentication.setElevator(null);
        }
    }

    SanteDB.authentication.setElevator(new SanteDBElevator(initializeView, false));
    initializeView($stateParams.id);
}]).controller("EmrEncounterEntryController", ["$scope", "$rootScope", "$timeout", "$state", function($scope, $rootScope, $timeout, $state) {
    

    $scope.doQueue = () => SanteEMR.showRequeue($scope.scopedObject);
    
    $scope.saveVisit = async function(form) {
        if(form.$invalid) {
            return;
        }

        try {
            SanteDB.display.buttonWait("#btnActEditsave", true);
            var encounter = await SanteEMR.saveVisitAsync($scope.scopedObject);
            if(encounter.extension && encounter.extension[ENCOUNTER_FLOW.EXTENSION_URL]) {
                encounter.extension[ENCOUNTER_FLOW.EXTENSION_URL][0] = await SanteDB.application.resolveReferenceExtensionAsync(encounter.extension[ENCOUNTER_FLOW.EXTENSION_URL][0]);
            }
            SanteDB.display.cascadeScopeObject($scope, ["encounter", "scopedObject"], encounter);
            toastr.success(SanteDB.locale.getString("ui.emr.encounter.save.success"));
        }
        catch(e) {
            $rootScope.errorHandler(e);
        }
        finally {
            SanteDB.display.buttonWait("#btnActEditsave", false);
        }
    }
}]);