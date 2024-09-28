/// <reference path="../../../.ref/js/santedb.js" />
angular.module('santedb').controller('EmrCheckinEncounterController', ["$scope", "$rootScope", "$timeout", function ($scope, $rootScope, $timeout) {

    $scope.patientId = null;
    $scope.$watch("patientId", async function (n, o) {
        if (n && n != o) {
            try {
                var patient = await SanteDB.resources.patient.getAsync(n, "full");
                $timeout(() => $scope.recordTarget = new Patient(patient));
            }
            catch (e) {
                $rootScope.errorHandler(e);
            }
        }
    });

    $scope.applyGuardExpression = function (data) {
        if (data.guard) {
            return $scope.$eval(data.guard, { recordTarget: $scope.recordTarget });
        }
        return true;
    }

    $("#checkinModal").on("hidden.bs.modal", function () {
        $timeout(() => {
            $scope.patientId = "";
            delete ($scope.recordTarget);
            delete ($scope.encounter);
        });
    });
}]);