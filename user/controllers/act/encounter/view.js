/// <reference path="../../../.ref/js/santedb.js" />
angular.module('santedb').controller('EmrEncounterViewController', ["$scope", "$rootScope", "$timeout", "$state", "$stateParams", function ($scope, $rootScope, $timeout, $state, $stateParams) {

    async function initializeView(encounterId) {
        try {
            var encounter = await SanteDB.resources.patientEncounter.getAsync(encounterId, "full");
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
}]);