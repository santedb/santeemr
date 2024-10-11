angular.module("santedb").controller("EmrAdminCarePathEditController", ["$scope", "$rootScope", "$timeout", "$stateParams", "$state", function($scope, $rootScope, $timeout, $stateParams, $state) {


    // Initialize the view
    async function initializeView(pathwayId) {
        try {
            var pathway = null;
            if(pathwayId) {
                pathway = await SanteDB.resources.carePathwayDefinition.getAsync(pathwayId);
                pathway.enrollment = `${pathway.enrollment}`;
                pathway.eligibility = pathway.eligibility.split("&").map(o => { return { expr: o }});
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

    async function saveCarePath(carePathForm) {
        if(carePathForm.$invalid) return;

        try {

            // Collapse the eligibility criteria
            $scope.pathway.eligibility = $scope.pathway.eligibility.map(o=>o.expr).join("&");
            if($scope.pathway.id) {
                await SanteDB.resources.carePathwayDefinition.updateAsync($scope.pathway.id, $scope.pathway);
            }
            else {
                await SanteDB.resources.carePathwayDefinition.insertAsync($scope.pathway);
            }
            toastr.success(SanteDB.locale.getString("ui.emr.admin.carePath.save.success"));
            $state.go("santedb-admin.emr.carePaths.index");
        }
        catch(e) {
            $rootScope.errorHandler(e);
        }
    }

    initializeView($stateParams.id);

    $scope.saveCarePath = saveCarePath;
}]);