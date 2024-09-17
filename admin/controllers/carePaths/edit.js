angular.module("santedb").controller("EmrAdminCarePathEditController", ["$scope", "$rootScope", "$timeout", "$stateParams", function($scope, $rootScope, $timeout, $stateParams) {


    async function initializeView(pathwayId) {
        try {
            var pathway = null;
            if(pathwayId) {
                pathway = await SanteDB.resources.carePathwayDefinition.getAsync(pathwayId);
                pathway.enrollment = `${pathway.enrollment}`;
                pathway.eligibility = pathway.eligibility.split("&");
            }
            else {
                pathway = new CarePathwayDefinition({
                    eligibility: [],
                    enrollment: 0
                });
            }

            $timeout(() => $scope.pathway = pathway);
        }
        catch(e) {
            $rootScope.errorHandler(e);
        }
    }

    initializeView($stateParams.id);
}]);