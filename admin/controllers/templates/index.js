angular.module('santedb').controller("EmrTemplateIndexController", ["$scope", "$rootScope", "$state", "$timeout", function ($scope, $rootScope, $state, $timeout) {

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

    $scope.uploadTemplate = function () {
        $("#uploadTemplateModal").modal('show');
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