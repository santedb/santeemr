angular.module('santedb').controller('ReportViewController', ["$scope", "$rootScope", "$stateParams", "$timeout", function ($scope, $rootScope, $stateParams, $timeout) {

    async function initializeView() {
        try {
            const report = await SanteDBBi.resources.report.getAsync($stateParams.id);
            $timeout(() => $scope.report = report);
        }
        catch(e) {
            $rootScope.errorHandler(e);
        }
    }
    
    initializeView();
}]);