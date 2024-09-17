angular.module("santedb").controller("EmrAdminCarePathController", ["$scope", "$rootScope", "$timeout", function($scope, $rootScope, $timeout) {

    $scope.renderEnrollment = (r) => r.enrollment == 0 ? "Manual" : "Auto";

    $scope.renderEligibility = (r) => `<code>${r.eligibility.replaceAll("<", "&lt;")}</code>`;
}]);