/// <reference path="../../.ref/js/santedb.js" />

angular.module('santedb').controller('EmrPatientDashboardController', ["$scope", "$rootScope", "$state", "$timeout", function ($scope, $rootScope, $state, $timeout) {

    // Bind to scope
    $scope.checkin = SanteEMR.showCheckin;
    $scope.patientHasOpenEncounter = SanteEMR.patientHasOpenEncounter;
   
}]);