/// <reference path="../../.ref/js/santedb.js"/>
angular.module('santedb').controller('CdssEditController', ["$scope", "$rootScope", "$timeout", "$state", "$stateParams", function ($scope, $rootScope, $timeout, $state, $stateParams) {

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

    async function initializeView(id) {
        try {
           
            if(ace && $("#cdssEditor").length == 1) {
            
                var cdssTxtSource = await SanteDB.api.ami.getAsync({
                    resource: `CdssLibraryDefinition/${id}`,
                    dataType: 'text',
                    headers: {
                        'X-SanteDB-Upstream' : true
                    },
                    query: {
                        _format: 'txt'
                    }
                });

                $timeout(() => {
                    $("#cdssEditor pre").html(cdssTxtSource.replaceAll("<", "&lt;").replaceAll(">","&gt;"));
                    var editor = ace.edit("cdssEditor");
                    editor.setTheme("ace/theme/sqlserver");
                    editor.session.setMode("ace/mode/cdss");
                });
            }
            else {
                var libraryDefinition = await SanteDB.resources.cdssLibraryDefinition.getAsync(id, null, null, true);
                $timeout(() => {
                    $scope.cdssLibrary = libraryDefinition;
                });
                var libraryHistory = await SanteDB.resources.cdssLibraryDefinition.findAssociatedAsync(id, "_history", null, null, true);
                $timeout(() =>{
                    $scope.cdssLibrary._history = libraryHistory.resource;
                });
            }
        }
        catch (e) {
            $rootScope.errorHandler(e);
        }
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
                        library = await SanteDB.resources.cdssLibraryDefinition.insertAsync($scope.cdssLibrary, true);
                    }

                    toastr.success(SanteDB.locale.getString("ui.admin.cdss.create.success"));
                    $state.go("santedb-admin.emr.cdss.view", { id: library.id });

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
        if(form.$invalid) {
            return;
        }
        uploadCdssLibraryDefinition(form, $scope.cdssLibrary.id);
    }
}]);