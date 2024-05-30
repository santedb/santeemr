/// <reference path="../../.ref/js/santedb.js" />

angular.module('santedb').controller('EmrPatientRegisterController', ["$scope", "$rootScope", "$state", "$transitions", "$interval", "$timeout", function ($scope, $rootScope, $state, $transitions, $interval, $timeout) {

    
    // No template use the default
    var templateId = $state.templateId;
    if (!templateId) {
        templateId = SanteDB.configuration.getAppSetting("template.patient") || "org.santedb.emr.patient";
    }

    // Initialize the view
    async function initializeView(tempalteId) {

        try {
            templateId = templateId || "org.santedb.emr.patient";
            var _entityTemplate = await SanteDB.application.getTemplateContentAsync(templateId);
            $timeout(() => $scope.entity = angular.copy(_entityTemplate));
        }
        catch (e) {
            $rootScope.errorHandler(e);
        }
    }

    // Check for duplicates
    async function checkDuplicates(patient) {
        try {
            // TODO: Invoke the $match operation
        }
        catch (e) {
            $rootScope.errorHandler(e);
        }
    }

    $scope.resetView = async function () {
        await initializeView(templateId);
    }

    initializeView(templateId);

    // Confirm navigation away in browser
    window.onbeforeunload = function () {
        var form = angular.element("#editForm").scope().editForm;
        return !form.$pristine;
    }

    // unbind the nav away
    $scope.$on("$destroy", function(s) {
        window.onbeforeunload = null;
    })
}]).controller("EmrPatientRegisterWidgetController", ["$scope", "$rootScope", "$timeout", function($scope, $rootScope, $timeout) {

    $scope.ageToDate = ageToDate;
    $scope.dateToAge = dateToAge;
}]);
