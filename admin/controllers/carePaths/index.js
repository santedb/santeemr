angular.module("santedb").controller("EmrAdminCarePathController", ["$scope", "$rootScope", "$timeout", function($scope, $rootScope, $timeout) {

    $scope.renderEnrollment = (r) => r.enrollment == 0 ? "Manual" : "Auto";

    $scope.renderEligibility = (r) => `<code>${r.eligibility.replaceAll("<", "lt;").split("&").join("<br/>").replaceAll("lt;", "&lt;")}</code>`;

    $scope.deleteCarePath = async function(id) {
        if(confirm(SanteDB.locale.getString("ui.emr.admin.carePath.delete.confirm"))) {
            try {
                await SanteDB.resources.carePathwayDefinition.deleteAsync(id);
                toastr.success(SanteDB.locale.getString("ui.emr.admin.carePath.delete.success"));
                $("#carePathTable").attr("newQueryId", true);
                $("#carePathTable table").DataTable().draw();
            }
            catch (e) {
                $rootScope.errorHandler(e);
            }
        }
    }
}]);