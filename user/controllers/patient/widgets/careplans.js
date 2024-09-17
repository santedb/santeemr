/// <reference path="../../../.ref/js/santedb.js"/>
angular.module('santedb').controller('EmrPatientCarePlanController', ['$scope', '$timeout', '$rootScope', function ($scope, $timeout, $rootScope) {


    async function initializeView(patientId) {
        try {
            var carePathways = await SanteDB.resources.carePathwayDefinition.invokeOperationAsync(null, "eligibility", { target: patientId, includeEnrolled: true });
        }
        catch(e) {
            $rootScope.errorHandler(e);
        }
    }

    initializeView($scope.scopedObject.id);
}]);
