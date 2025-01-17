
angular.module('santedb').controller('EmrDashboardController', ["$scope", "$rootScope", "$state", "$templateCache", "$interval", function ($scope, $rootScope, $state, $templateCache, $interval) {

    // Common queries for widgets on the dashboard
    $scope.dashboardScope = {
        currentYear : {
            'from-date' : new Date().getFirstDayOfYear(),
            'to-date': new Date()
        },
        yesterday : {
            'from-date' : new Date().yesterday(),
            'to-date': new Date()
        }
    };

}]);