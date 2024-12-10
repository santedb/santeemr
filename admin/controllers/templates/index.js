angular.module('santedb').controller("EmrTemplateIndexController", [ "$scope", "$rootScope", "$state", "$timeout", function($scope, $rootScope, $state, $timeout) {

    $scope.renderStatus = function(tpl) {
        var retVal = "";
        if(tpl.active) {
            retVal += "<span class='badge badge-success'><i class='fas fa-fw fa-check-circle'></i> {{ 'ui.model.dataTemplateDefinition.status.active' | i18n }}</span>";
        } else {
            retVal += "<span class='badge badge-danger'><i class='fas fa-fw fa-times-circle'></i> {{ 'ui.model.dataTemplateDefinition.status.inactive' | i18n }}</span>";
        }

        if(tpl.isReadonly) {
            retVal += "<span class='ml-2 badge badge-dark'><i class='fas fa-fw fa-lock'></i> {{ 'ui.model.dataTemplateDefinition.status.readonly' | i18n }}</span>";
        }

        if(tpl.public) {
            retVal += "<span class='ml-2 badge badge-primary'><i class='fas fa-fw fa-list'></i> {{ 'ui.model.dataTemplateDefinition.status.public' | i18n }}</span>";
        }
        return retVal;
    }

    $scope.renderViews = function(tpl) {
        if(tpl.views) {
            return tpl.views.map(v=>`<span class='badge badge-info ml-2 p-1' style='border-radius: 0'><i class='far fa-fw fa-window-maximize'></i> ${v.type}</span>`).join(" ");
        }
        return "";
    }
}]);