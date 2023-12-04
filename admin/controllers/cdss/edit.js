/// <reference path="../../.ref/js/santedb.js"/>
angular.module('santedb').controller('CdssEditController', ["$scope", "$rootScope", "$timeout", "$state", "$stateParams", "$interval", function ($scope, $rootScope, $timeout, $state, $stateParams, $interval) {

    var _editor = null;

    async function checkDuplicate(query) {
        try {
            query._includeTotal = true;
            query._count = 0;
            query._upstream = true;
            var duplicate = await SanteDB.resources.cdssLibraryDefinition.findAsync(query);
            return duplicate.size == 0;
        }
        catch (e) {
            console.warn(e);
            return false;
        }
    }

    async function validateEditor(force) {
        try {
            var value = _editor.getValue();
            if (force !== true && value.length == $scope.cdssLibrary._lastCheckLength) {
                return;
            }

            $scope.cdssLibrary._lastCheckLength = value.length;
            var issues = await SanteDB.resources.cdssLibraryDefinition.invokeOperationAsync(null, "validate", {
                definition: value,
                name: $scope.cdssLibrary.library.id
            }, true);

            _editor.getSession().clearAnnotations();
            if (issues.issue) {
                annotations = issues.issue.map(i => {

                    if (!i.refersTo || i.refersTo.indexOf("@") == -1) {
                        return {
                            row: 0,
                            column: 1,
                            text: i.text,
                            type: i.priority == "Error" ? "error" : i.priority == "Warning" ? "warn" : "info"
                        }; // doesn't apply
                    }
                    var ln = i.refersTo.substring(i.refersTo.indexOf("@") + 1).split(":");
                    return {
                        row: parseInt(ln[0]) - 1,
                        column: parseInt(ln[1]),
                        text: i.text,
                        type: i.priority == "Error" ? "error" : i.priority == "Warning" ? "warning" : "info"
                    };
                });
                _editor.getSession().setAnnotations(annotations);
                $timeout(() => $scope.validationIssues = annotations);
            }
            return issues.issue.find(o=>o.priority == 'Error') == null;
        }
        catch (e) {
            console.error(e);
            return false;
        }

    }

    async function initializeView(id) {
        try {

            var libraryDefinition = await SanteDB.resources.cdssLibraryDefinition.getAsync(id, null, null, true);
            $timeout(() => {
                $scope.cdssLibrary = libraryDefinition;
            });

            if (ace && $("#cdssEditor").length == 1) {

                var cdssTxtSource = await SanteDB.api.ami.getAsync({
                    resource: `CdssLibraryDefinition/${id}`,
                    dataType: 'text',
                    headers: {
                        'X-SanteDB-Upstream': true
                    },
                    query: {
                        _format: 'txt'
                    }
                });

                $timeout(() => {
                    var langTools = ace.require("ace/ext/language_tools");
                    _editor = ace.edit("cdssEditor", {
                        theme: "ace/theme/sqlserver",
                        mode: "ace/mode/cdss",
                        wrap: true,
                        maxLines: 60,
                        minLines: 2,
                        hasCssTransforms: true,
                        value: cdssTxtSource,
                        keyboardHandler: "ace/keyboard/vscode",
                        enableBasicAutocompletion: true, 
                        enableLiveAutocompletion: true
                    });

                    _editor.commands.addCommand({
                        name: 'save',
                        bindKey: {win: 'Ctrl-S', mac: "Cmd-S" },
                        exec: async function(editor) {
                            var valid = await validateEditor(true);
                            if(!valid) {
                                toastr.error(SanteDB.locale.getString("ui.admin.cdss.publish.invalid"));
                            }
                            else if(confirm(SanteDB.locale.getString("ui.admin.cdss.publish.confirm"))) {
                                try {
                                    _editor.setReadOnly(true);
                                    await SanteDB.api.ami.putAsync({
                                        resource: `CdssLibraryDefinition`,
                                        id: $stateParams.id,
                                        dataType: 'text',
                                        data: _editor.getValue(),
                                        contentType: "text/plain",
                                        enableBasicAutocompletion: true,
                                        headers: {
                                            "X-SanteDB-Upstream": true
                                        }
                                    });
                                    toastr.success(SanteDB.locale.getString("ui.admin.cdss.publish.success"));
                                }
                                catch(e) {
                                    $rootScope.errorHandler(e);
                                }
                                finally {
                                    _editor.setReadOnly(false);
                                }
                            }
                        }
                    })
                    $scope.validateInterval = $interval(validateEditor, 5000);

                    validateEditor();
                    $scope.$on('$destroy', function () { $interval.cancel($scope.validateInterval); });
                });
            }
            else {
                var libraryHistory = await SanteDB.resources.cdssLibraryDefinition.findAssociatedAsync(id, "_history", null, null, true);
                $timeout(() => {
                    $scope.cdssLibrary._history = libraryHistory.resource;
                });
            }
        }
        catch (e) {
            $rootScope.errorHandler(e);
        }
    }

    $scope.gotoIssue = function (issue) {
        _editor.gotoLine(issue.row + 1, issue.column);
    }

    if ($stateParams.id) {
        initializeView($stateParams.id);
    }
    else {
        $scope.cdssLibrary = {
            "$type": "CdssLibraryDefinitionInfo",
            _mode: 'upload',
            library: {
            }
        }
    };

    async function saveCdssLibrary(form) {
        // Mark duplicates
        var failedValidation = false;
        if ($scope.cdssLibrary.library.oid) {
            var valid = await checkDuplicate({ oid: $scope.cdssLibrary.library.oid });
            $timeout(() => $scope.saveCdssLibraryForm.libraryOid.$setValidity('duplicate', valid));
            failedValidation |= !valid;
        }
        if ($scope.cdssLibrary.library.id) {
            var valid = await checkDuplicate({ id: $scope.cdssLibrary.library.id });
            $timeout(() => $scope.saveCdssLibraryForm.libraryId.$setValidity('duplicate', valid));
            failedValidation |= !valid;
        }
        if ($scope.cdssLibrary.library.name) {
            var valid = await checkDuplicate({ name: $scope.cdssLibrary.library.name });
            $timeout(() => $scope.saveCdssLibraryForm.libraryName.$setValidity('duplicate', valid));
            failedValidation |= !valid;
        }

        if (form.$invalid || failedValidation) {
            return;
        }

        SanteDB.display.buttonWait("#btnSaveLibrary", true);

        switch ($scope.cdssLibrary._mode) {
            case 'upload':
                uploadCdssLibraryDefinition(form);
                return;
            default:
                try {
                    SanteDB.display.buttonWait("#btnSaveLibrary", true);

                    var library = null;
                    if ($scope.cdssLibrary.id) {
                        library = await SanteDB.resources.cdssLibraryDefinition.updateAsync($scope.cdssLibrary.id, $scope.cdssLibrary, true);
                    }
                    else {
                        $scope.cdssLibrary.library.status = 'DontUse';
                        library = await SanteDB.resources.cdssLibraryDefinition.insertAsync($scope.cdssLibrary, true);
                        $state.go("santedb-admin.emr.cdss.edit", { id: library.id });
                    }

                    toastr.success(SanteDB.locale.getString("ui.admin.cdss.create.success"));

                }
                catch (e) {
                    $rootScope.errorHandler(e);
                }
                finally {
                    SanteDB.display.buttonWait("#btnSaveLibrary", false);
                }
        }
    }

    function uploadCdssLibraryDefinition(form, originalId) {
        var file_data = form.source.$$element.prop('files')[0];
        var form_data = new FormData();
        form_data.append('source', file_data);
        SanteDB.display.buttonWait("#btnSaveLibrary", true);
        $.ajax({
            cache: false,
            contentType: false,
            processData: false,
            headers: {
                "X-SanteDB-Upstream": true
            },
            method: originalId ? 'PUT' : 'POST',
            dataType: 'json',
            url: originalId ? `/ami/CdssLibraryDefinition/${originalId}` : "/ami/CdssLibraryDefinition",
            data: form_data,
            success: function (data) {
                try {
                    if (!data.issue || data.issue.length == 0) {
                        toastr.success(SanteDB.locale.getString('ui.admin.cdss.upload.success'));
                        if (!originalId) {
                            $state.go('santedb-admin.emr.cdss.view', { id: data.id });
                        }
                        else {
                            $state.reload();
                        }
                    }
                    else {
                        toastr.success(SanteDB.locale.getString('ui.admin.cdss.upload.error', { error: data.message }));
                        $rootScope.errorHandler(data);
                    }
                }
                catch (e) {
                    console.error(e);
                }
                finally {
                    SanteDB.display.buttonWait("#btnSaveLibrary", false);
                }
            },
            error: function (xhr, status, error) {
                $rootScope.errorHandler(xhr.responseJSON);
                toastr.error(SanteDB.locale.getString('ui.admin.cdss.upload.error', { status: status, error: error }));
                SanteDB.display.buttonWait("#btnSaveLibrary", false);

            }
        });
    }

    $scope.downloadCdssLibrary = function (format) {
        var win = window.open(`/ami/CdssLibraryDefinition/${$scope.cdssLibrary.id}?_format=${format}&_upstream=true`, '_blank');
        win.onload = function (e) {
            win.close();
        };
    }

    $scope.uploadReplacementLibrary = function () {
        $("#uploadCdssLibraryModal").modal('show');
    }

    $scope.saveCdssLibrary = saveCdssLibrary;
    $scope.uploadCdssLibraryDefinition = function (form) {
        if (form.$invalid) {
            return;
        }
        uploadCdssLibraryDefinition(form, $scope.cdssLibrary.id);
    }
}]);