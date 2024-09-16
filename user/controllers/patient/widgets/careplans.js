/// <reference path="../../../.ref/js/santedb.js"/>
angular.module('santedb').controller('EmrPatientCarePlanController', ['$scope', '$timeout', '$rootScope', function ($scope, $timeout, $rootScope) {


    async function initializeView(patientId) {
        try {
            var carePathways = await SanteDB.resources.carePathwayDefinition.findAsync({}, "full");
            var careplans = await SanteDB.resources.carePlan.findAsync({ statusConcept: StatusKeys.Active }, "full");
            careplans.resource = careplans.resource || [];

            $timeout(() => {
                $scope.carePathways = carePathways.map(cp => {
                    cp._enrolment = careplans.resource.find(plan => plan.pathway == cp.id);
                    return cp;
                });
            });
        }
        catch(e) {
            $rootScope.errorHandler(e);
        }
    }

    initializeView($scope.scopedObject.id);
}]);
