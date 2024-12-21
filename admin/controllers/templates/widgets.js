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
            toastr.success(SanteDB.locale.getString("ui.emr.admin.templates.save.success"));
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
            if ($scope.scopedObject.id) {
                query.id = `!${$scope.scopedObject.id}`;
            }
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

    $scope.saveTemplateDefinition = async function (form) {
        if (form.$invalid) {
            return;
        }

        try {
            await SanteDB.resources.dataTemplateDefinition.updateAsync($scope.editObject.id, $scope.editObject);
            toastr.success(SanteDB.locale.getString("ui.emr.admin.templates.save.success"));
            await SanteDB.display.getParentScopeVariable($scope, "loadTemplate")($scope.editObject.id);
        }
        catch (e) {
            $rootScope.errorHandler(e);
        }
    }

}]).controller("EmrEditTemplateModelController", ["$scope", "$rootScope", "$timeout", "$interval", function ($scope, $rootScope, $timeout, $interval) {

    var _editor = null;

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

    $scope.saveTemplateDefinition = async function (form) {
        try {
            if ($scope.panel.editForm.$dirty) {
                var patch = new Patch({
                    appliesTo: {
                        id: $scope.scopedObject.id,
                        type: "DataTemplateDefinition"
                    },
                    change: [
                        {
                            op: PatchOperationType.Replace,
                            path: "template.content",
                            value: _editor.getValue()
                        }
                    ]
                })
                await SanteDB.resources.dataTemplateDefinition.patchAsync($scope.scopedObject.id, null, patch);
                toastr.success(SanteDB.locale.getString("ui.emr.admin.templates.save.success"));
                $scope.panel.editForm.$setPristine();
            }
            await SanteDB.display.getParentScopeVariable($scope, "loadTemplate")($scope.scopedObject.id);
        }
        catch (e) {
            $rootScope.errorHandler(e);
        }
    }

}]).controller("EmrEditTemplateViewController", ["$scope", "$rootScope", "$timeout", "$interval", "$compile", function ($scope, $rootScope, $timeout, $interval, $compile) {

    var _editors = {};
    var _needRefresh= false;

    function bindViewEditors(id) {

    }

    $scope.hasView = (v) => $scope.editObject.views && $scope.editObject.views.find(o => o.type == v);
    $scope.addView = function (v) {
        $scope.editObject.views = $scope.editObject.views || [];
        $scope.editObject.views.push({ type: v, contentType: 'div' });
        $scope.panel.editForm.$setDirty();
        $timeout(() => {
            $(`#viewTab${v}`).click();
        }, 500);
        bindTabEvents(v);
    }

    function updatePreview(viewTab) {
        var content = $compile(_editors[viewTab].getValue())($scope);
        $(`#view${viewTab}Preview`).html(content);
    }

    function bindTabEvents(viewTab) {

        var id = `#viewTab${viewTab}`;

        if ($(id).length > 0) {
            $(id).on("shown.bs.tab", function () {

                if (!_editors[viewTab]) {
                    _editors[viewTab] = new HtmlViewAceEditor(`view${viewTab}Editor`, $scope.editObject, viewTab);
                    _editors[viewTab].onChange(() => {
                        _needRefresh = true;
                        $scope.panel.editForm.$setDirty();
                    });
                    validateInterval = $interval(() => {
                        if (_needRefresh) {
                            _needRefresh = false;
                            updatePreview(viewTab);
                        }
                    }, 5000);
                    updatePreview(viewTab);
                    _editors[viewTab].onSave(() => $scope.panel.editForm.$setPristine());
                }
            });

        }
        else {
            setTimeout(() => bindTabEvents(viewTab), 250);

        }

    }

    async function bindViewEditors(n, o) {

        if (n === "Edit") {
            $scope.ownerForm = $scope.panel.editForm;
            if (ace && $("#formViews").length == 1) {
                await SanteDB.resources.dataTemplateDefinition.checkoutAsync($scope.scopedObject.id, true);
                $scope.scopedObject.views.forEach(v => bindTabEvents(v.type));

            }
            else {
                setTimeout(() => bindViewEditors(n, o), 500);
            }
        }
    }

    $scope.$watch("panel.view", bindViewEditors);

    function renderViews(object) {
        $scope.act = $scope.scopedObject.filledJson;
        if (object && object.views) {
            object.views.forEach(v => {
                var divEle = $(`#preview${v.type}`);
                if (divEle.length > 0) {
                    var content = $compile(v.content)($scope);
                    divEle.html(content);
                }
                else {
                    setTimeout(() => renderViews(object), 500);
                }
            });
        }

    }
    $scope.$watch("scopedObject", function (n, o) {
        if (n && n.views) {
            renderViews(n);
        }
    })
}]);