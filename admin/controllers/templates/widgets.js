/// <reference path="../../.ref/js/santedb.js"/>
/*
 * Copyright (C) 2021 - 2025, SanteSuite Inc. and the SanteSuite Contributors (See NOTICE.md for full copyright notices)
 * Portions Copyright (C) 2019 - 2021, Fyfe Software Inc. and the SanteSuite Contributors
 * Portions Copyright (C) 2015-2018 Mohawk College of Applied Arts and Technology
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you
 * may not use this file except in compliance with the License. You may
 * obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
 * License for the specific language governing permissions and limitations under
 * the License.
 *
 */

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


}]).controller("EmrEditTemplateModelController", ["$scope", "$rootScope", "$timeout", "$interval", function ($scope, $rootScope, $timeout, $interval) {

    var _editor = null;

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
        else if (o === "Edit" && n !== "Edit") // Back to view
        {
            await SanteDB.display.getParentScopeVariable($scope, "loadTemplate")($scope.scopedObject.id);
        }
    }
    
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
            }
        }
        catch (e) {
            $rootScope.errorHandler(e);
        }
    }

    $scope.$watch("panel.view", bindAceEditor);

}]).controller("EmrEditTemplateViewController", ["$scope", "$rootScope", "$timeout", "$interval", "$compile", function ($scope, $rootScope, $timeout, $interval, $compile) {

    var _editors = {};


    $scope.getViewUrl = (v) => `/app/Template/${$scope.scopedObject.mnemonic}/view/${v}`;
    $scope.hasView = (v) => $scope.editObject.views && $scope.editObject.views.find(o => o.type == v);
    $scope.addView = function (v) {
        $scope.editObject.views = $scope.editObject.views || [];
        $scope.editObject.views.push({ type: v, contentType: 'svd', content: '<SimplifiedViewDefinition xmlns="http://santedb.org/model/template/view"></SimplifiedViewDefinition>' });
        $scope.panel.editForm.$setDirty();
        $timeout(() => {
            $(`#viewTab${v}`).click();
        }, 500);
        bindTabEvents(v);
    }
    $scope.convertHtml = async function(view) {
        if(confirm(SanteDB.locale.getString("ui.emr.admin.templates.view.convert.confirm"))) {
            try {
                var content = _editors[view.type].getValue();
                view.content = await SanteDB.resources.dataTemplateDefinition.invokeOperationAsync(null, "render", { "view": content, "contentType" : "svd" }, null, null, "html");
                view.contentType = "div";
                _editors[view.type].destroy();
                delete _editors[view.type];
                createEditor(view.type);
            }
            catch(e) {
                $rootScope.errorHandler(e);
            }
        }
    }
    $scope.removeView = function(viewIdx) {
        if(confirm(SanteDB.locale.getString("ui.emr.admin.templates.view.remove.confirm"))) {
            var view = $scope.editObject.views[viewIdx];
            $scope.editObject.views.splice(viewIdx, 1);
            _editors[view.type].destroy();
            delete(_editors[view.type]);
        }
    }
    

    async function updatePreview(viewTab) {
        try {
            _editors[viewTab].clearAnnotations();
            var viewDefinition = $scope.editObject.views.find(o => o.type == viewTab);
            var content = _editors[viewTab].getValue();
            content = await SanteDB.resources.dataTemplateDefinition.invokeOperationAsync(null, "render", { "view": content, "contentType": viewDefinition.contentType }, null, null, "html");
            content = $compile(content)($scope);
            $(`#view${viewTab}Preview`).html(content);
        }
        catch (e) {
            var exception = null;
            if (e.detail) {
                exception = JSON.parse(e.detail.responseText);
            }
            else if (e.$type) {
                exception = e;
            }
            else if (e.message && e.message.indexOf("Syntax error, unrecognized expression: ") == 0) // JQUERY
            {
                exception = JSON.parse(e.message.substring(39));
            }

            if (exception) {
                _editors[viewTab].setIssueException(new Exception(exception.$type, exception.message, exception.detail, exception.cause, exception.stack, exception.policyId, exception.policyOutcome, exception.rules, exception.data));
            }
            else {
                console.error(e);
            }
        }
    }

    function bindTabEvents(viewTab) {

        var id = `#viewTab${viewTab}`;

        if ($(id).length > 0) {
            $(id).on("shown.bs.tab", function () {

                createEditor(viewTab);
            });

        }
        else {
            setTimeout(() => bindTabEvents(viewTab), 250);

        }

    }

    function createEditor(viewType) {
        if (!_editors[viewType]) {
            var _needRefresh = false;
            _editors[viewType] = new ViewAceEditor(`view${viewType}Editor`, $scope.editObject, viewType);
            _editors[viewType].onChange(() => {
                _needRefresh = true;
                $scope.panel.editForm.$setDirty();
            });
            validateInterval = setInterval(() => {
                if (_needRefresh) {
                    _needRefresh = false;
                    updatePreview(viewType);
                }
            }, 5000);
            $scope.$on('$destroy', function (s) {
                clearInterval(validateInterval);
            });
            updatePreview(viewType);
            _editors[viewType].onSave(() => $scope.panel.editForm.$setPristine());
        }
    }

    async function bindViewEditors(n, o) {

        if (n === "Edit") {
            if (ace && $("#formViews").length == 1) {
                await SanteDB.resources.dataTemplateDefinition.checkoutAsync($scope.scopedObject.id, true);
                $scope.scopedObject.views.forEach(v => bindTabEvents(v.type));

            }
            else {
                setTimeout(() => bindViewEditors(n, o), 500);
            }
        }
        else if (o === "Edit" && n !== "Edit") // Back to view
        {
            Object.keys(_editors).forEach(k => _editors[k].destroy());
            _editors = {};
            await SanteDB.display.getParentScopeVariable($scope, "loadTemplate")($scope.scopedObject.id);
        }
    }

    $scope.$watch("panel.view", bindViewEditors);

    function bindEditorDiv(v) {
        var divEle = $(`#preview${v.type}`);
        if (divEle.length > 0) {
            var content = $compile(v.content)($scope);
            divEle.html(content);
        }
        else {
            setTimeout(() => bindEditorDiv(v), 500);
        }
    }

    function renderViews(object) {
        $scope.act =  $scope.scopedObject.filledJson;
        if (object && object.views) {
            object.views.forEach(v => {
                bindEditorDiv(v);
            });
        }

    }
    $scope.$watch("scopedObject", function (n, o) {
        if (n && n.views) {

            renderViews(n);
        }
    })

     // Save template definition
     $scope.saveTemplateDefinition = async function (form) {
        if (form.$invalid) {
            return;
        }

        try {
            $scope.editObject.active = false;

            $scope.editObject.views.filter(v=>_editors[v.type]).forEach(v => v.content = _editors[v.type].getValue());
            await SanteDB.resources.dataTemplateDefinition.updateAsync($scope.editObject.id, $scope.editObject);

            SanteDB.display.getParentScopeVariable($scope, 'loadTemplate')($scope.editObject.id);
            toastr.success(SanteDB.locale.getString("ui.emr.admin.templates.save.success"));
        }
        catch (e) {
            $scope.$root.errorHandler(e);
        }
    }
}]);