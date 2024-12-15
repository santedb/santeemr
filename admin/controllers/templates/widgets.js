/// <reference path="../../.ref/js/santedb.js"/>

// Add the data template functions to the scope
function addDataTemplateFunctionsToScope($scope, $timeout) {

    // Save template definition
    $scope.saveTemplateDefinition = async function (form) {
        if (form.$invalid) {
            return;
        }

        try {
            $scope.editObject.active = false;
            var updatedScope = await SanteDB.resources.dataTemplateDefinition.updateAsync($scope.editObject.id, $scope.editObject);

            SanteDB.display.getParentScopeVariable($scope, 'loadTemplate')($scope.editObject.id);
            toastr.success(SanteDB.locale.getString("org.santedb.emr.admin.templates.save.success"));
        }
        catch (e) {
            $scope.$root.errorHandler(e);
        }
    }

}

angular.module('santedb').controller('ViewTemplatePropertiesController', ["$scope", "$rootScope", "$timeout", function ($scope, $rootScope, $timeout) {

    addDataTemplateFunctionsToScope($scope, $timeout);

    async function checkDuplicate(query) {
        try {
            query._includeTotal = true;
            query._count = 0;
            query._upstream = true;
            var duplicate = await SanteDB.resources.dataTemplateDefinition.findAsync(query);
            return duplicate.size == 0;
        }
        catch (e) {
            console.warn(e);
            return false;
        }
    }

    $scope.$watch("editObject.mnemonic", async function (n, o) {
        if (n && n != o) {
            var isDup = await checkDuplicate({ mnemonic: n });
            $timeout(() => $scope.panel.editForm.mnemonic.$setValidity("duplicate", isDup));
        }
    });

    $scope.$watch("editObject.oid", async function (n, o) {
        if (n && n != o) {
            var isDup = await checkDuplicate({ mnemonic: n });
            $timeout(() => $scope.panel.editForm.oid.$setValidity("duplicate", isDup));
        }
    });

}]).controller("EmrEditTemplateModelController", ["$scope", "$rootScope", "$timeout", "$interval", function ($scope, $rootScope, $timeout, $interval) {

    addDataTemplateFunctionsToScope($scope, $timeout);

    async function bindAceEditor(n, o) {

        if (n === "Edit") {
            if (ace && $("#modelEditor").length == 1) {

                await SanteDB.resources.dataTemplateDefinition.checkoutAsync($scope.scopedObject.id, true);

                _editor = new RimAceEditor('modelEditor', $scope.scopedObject);
                _editor.onChange((value) => {
                    $scope.panel.editForm.$setDirty();
                });
                _editor.onSave(() => $scope.panel.editForm.$setPristine());
                _editor.onAnnotationChange((issues) => $timeout(() => $scope.validationIssues = issues));
                validateInterval = $interval(_editor.validateEditor, 5000);
                _editor.validateEditor(true);
                $scope.$on('$destroy', function (s) {
                    $interval.cancel(validateInterval);
                    SanteDB.resources.dataTemplateDefinition.checkinAsync(s.currentScope.scopedObject.id, true);
                    window.onbeforeunload = null;
                });
            }
            else {
                setTimeout(() => bindAceEditor(n, o), 500);
            }
        }
    }

    $scope.$watch("panel.view", bindAceEditor);

}]);