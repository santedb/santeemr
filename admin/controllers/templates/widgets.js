/// <reference path="../../.ref/js/santedb.js"/>

// Add the data template functions to the scope
function addDataTemplateFunctionsToScope($scope, $timeout) {

    // Save template definition
    $scope.saveTemplateDefinition = async function(form) {
        if(form.$invalid) {
            return;
        }

        try {
            $scope.editObject.active = false;
            var updatedScope = await SanteDB.resources.dataTemplateDefinition.updateAsync($scope.editObject.id, $scope.editObject);

            SanteDB.display.getParentScopeVariable($scope, 'loadTemplate')($scope.editObject.id);
            toastr.success(SanteDB.locale.getString("org.santedb.emr.admin.templates.save.success"));
        }
        catch(e) {
            $scope.$root.errorHandler(e);
        }
    }

}

angular.module('santedb').controller('ViewTemplatePropertiesController', [ "$scope", "$rootScope", "$timeout", function($scope, $rootScope, $timeout) {

    addDataTemplateFunctionsToScope($scope, $timeout);

}]).controller("EmrEditTemplateModelController", [ "$scope", "$rootScope", "$timeout", function($scope, $rootScope, $timeout) {

    addDataTemplateFunctionsToScope($scope, $timeout);

}]);