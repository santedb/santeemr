/// <reference path="../../.ref/js/santedb-model.js" />
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
angular.module('santedb').controller("EmrTemplateIndexController", ["$scope", "$rootScope", "$state", "$timeout", function ($scope, $rootScope, $state, $timeout) {


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

    $scope.renderStatus = function (tpl) {
        var retVal = "";
        if (tpl.active) {
            retVal += "<span class='badge badge-success'><i class='fas fa-fw fa-check-circle'></i> {{ 'ui.model.dataTemplateDefinition.status.active' | i18n }}</span>";
        } else {
            retVal += "<span class='badge badge-danger'><i class='fas fa-fw fa-times-circle'></i> {{ 'ui.model.dataTemplateDefinition.status.inactive' | i18n }}</span>";
        }

        if (tpl.isReadonly) {
            retVal += "<span class='ml-2 badge badge-dark'><i class='fas fa-fw fa-lock'></i> {{ 'ui.model.dataTemplateDefinition.status.readonly' | i18n }}</span>";
        }

        if (tpl.public) {
            retVal += "<span class='ml-2 badge badge-primary'><i class='fas fa-fw fa-list'></i> {{ 'ui.model.dataTemplateDefinition.status.public' | i18n }}</span>";
        }
        return retVal;
    }

    $scope.renderName = function (tpl) {
        return `<i class="${tpl.icon}"></i> ${tpl.name} <br/><small>${tpl.mnemonic}</small>`;
    }

    $scope.renderVersion = function (tpl) {
        if (tpl.meta) {
            return tpl.version;
        }
        return "1.0";
    }

    $scope.renderViews = function (tpl) {
        if (tpl.views) {
            return tpl.views.map(v => `<i class='far fa-fw fa-window-maximize'></i> ${SanteDB.locale.getString("ui.model.dataTemplateDefinition.views." + v.type)}`).join(" ");
        }
        return "";
    }

    $scope.downloadTemplate = function (id) {
        var win = window.open(`/ami/DataTemplateDefinition/${id}?_download=true`, '_blank');
        win.onload = function (e) {
            win.close();
        };
    }

    $scope.$watch("newTemplate.mnemonic", async function (n, o) {
        if (n && n != o) {
            var isDup = await checkDuplicate({ mnemonic: n });
            $timeout(() => $scope.createTemplateForm.mnemonic.$setValidity("duplicate", isDup));
        }
    });

    $scope.$watch("newTemplate.oid", async function (n, o) {
        if (n && n != o) {
            var isDup = await checkDuplicate({ mnemonic: n });
            $timeout(() => $scope.createTemplateForm.oid.$setValidity("duplicate", isDup));
        }
    });

    $scope.uploadTemplate = function () {
        $("#uploadTemplateModal").modal('show');
    }

    $scope.createTemplate = function() {
        $scope.newTemplate = {
            "$type": "DataTemplateDefinition",
            "version": 1,
            "active": false,
            "scopes": [],
            "template": {
                "type":"content",
                "content": '{ "$type": "Act" }'
            }
        };

        $("#createTemplateModal").modal('show');
    }
    $scope.toggleActive = async function (id, idx) {
        var data = $("#templateTypeTable table").DataTable().row(idx).data();
        if (confirm(SanteDB.locale.getString("ui.emr.admin.templates.toggle.confirm"))) {
            try {
                SanteDB.display.buttonWait(`#DataTemplateDefinitionenable${idx}`, true);
                SanteDB.display.buttonWait(`#DataTemplateDefinitiondisable${idx}`, true);

                var patch = new Patch({
                    appliesTo: {
                        type: "DataTemplateDefinition",
                        id: id
                    },
                    change: [
                        {
                            op: PatchOperationType.Replace,
                            path: "active",
                            value: !data.active
                        }
                    ]
                });

                await SanteDB.resources.dataTemplateDefinition.patchAsync(id, null, patch);
                toastr.success(SanteDB.locale.getString("ui.emr.admin.templates.save.success"));
                $("#templateTypeTable table").DataTable().draw();
            }
            catch (e) {
                $rootScope.errorHandler(e);
            }
            finally {
                SanteDB.display.buttonWait(`#DataTemplateDefinitionenable${idx}`, false);
                SanteDB.display.buttonWait(`#DataTemplateDefinitiondisable${idx}`, false);
            }
        }
    }

    $scope.restoreTemplate = async function(id, idx) {
        if (confirm(SanteDB.locale.getString("ui.emr.admin.templates.restore.confirm"))) {
            try {
                SanteDB.display.buttonWait(`#DataTemplateDefinitionrestore${idx}`, true);

                var patch = new Patch({
                    appliesTo: {
                        type: "DataTemplateDefinition",
                        id: id
                    },
                    change: [
                        {
                            op: PatchOperationType.Remove,
                            path: "obsoletionTime",
                            value: null
                        },
                        {
                            op: PatchOperationType.Remove, 
                            path: "obsoletedBy",
                            value: null
                        }
                    ]
                });
                await SanteDB.resources.dataTemplateDefinition.patchAsync(id, null, patch);
                toastr.success(SanteDB.locale.getString("ui.emr.admin.templates.restore.success"));
                $("#templateTypeTable table").DataTable().draw();
            }
            catch (e) {
                $rootScope.errorHandler(e);
            }
            finally {
                SanteDB.display.buttonWait(`#DataTemplateDefinitionrestore${idx}`, false);
            }
        }
    }

    $scope.removeTemplate = async function (id, idx) {
        if (confirm(SanteDB.locale.getString("ui.emr.admin.templates.remove.confirm"))) {
            try {
                SanteDB.display.buttonWait(`#DataTemplateDefinitionremove${idx}`, true);

                await SanteDB.resources.dataTemplateDefinition.deleteAsync(id);
                toastr.success(SanteDB.locale.getString("ui.emr.admin.templates.remove.success"));
                $("#templateTypeTable table").DataTable().draw();
            }
            catch (e) {
                $rootScope.errorHandler(e);
            }
            finally {
                SanteDB.display.buttonWait(`#DataTemplateDefinitionremove${idx}`, false);
            }
        }
    }
    $scope.doCreateTemplate = async function(form) {
        if(form.$invalid) {
            return;
        }

        try {
            SanteDB.display.buttonWait("#btnSubmit", true);
            var submission = angular.copy($scope.newTemplate);
            submission = await SanteDB.resources.dataTemplateDefinition.insertAsync(submission);

            // Toast success and nav
            toastr.success(SanteDB.locale.getString("ui.emr.admin.template.create.success"));
            $state.go("santedb-admin.emr.templates.view", { id: submission.id });
        }
        catch(e) {
            $rootScope.errorHandler(e);
        }
        finally {
            SanteDB.display.buttonWait("#btnSubmit", false);
        }
    }

    $scope.doUploadTemplate = function (form) {
        if (form.$invalid) return;

        try {
            SanteDB.display.buttonWait("#btnSubmit", true);
            var file_data = $('#sourceFile').prop('files')[0];
            var form_data = new FormData();
            form_data.append('source', file_data);
            $.ajax({
                cache: false,
                contentType: false,
                processData: false,
                method: 'POST',
                url: "/ami/DataTemplateDefinition",
                data: form_data,
                success: function (data) {
                    console.log('Success');
                    toastr.success(SanteDB.locale.getString('ui.emr.admin.upload.success'));
                    $("#templateTypeTable table").DataTable().draw();
                    $("#uploadTemplateModal").modal('hide');
                },
                error: function (xhr, status, error) {
                    SanteDB.display.buttonWait("#btnSubmit", false);
                    $rootScope.errorHandler(JSON.parse(xhr.responseText));
                }
            });

        }
        catch (e) {
            $rootScope.errorHandler(e);
        }

    }
}]);