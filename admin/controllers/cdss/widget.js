/// <reference path="../../.ref/js/santedb.js"/>
angular.module('santedb').controller('CdssWidgetController', ["$scope", "$rootScope", "$timeout", "$state", "$stateParams", function ($scope, $rootScope, $timeout, $state, $stateParams) {
    
    $scope.filterDatasets = (r) => r.$type == "SanteDB.Cdss.Xml.Model.CdssDatasetDefinition, SanteDB.Cdss.Xml";

    $scope.countRows = (dat) => dat.csv.split('\n').length;
    
}]);