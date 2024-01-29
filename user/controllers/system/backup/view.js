/// <reference path="../../../.ref/js/santedb.js"/>
angular.module('santedb').controller("EmrBackupViewController", ["$scope", "$rootScope", "$timeout", "$stateParams", "$state", function ($scope, $rootScope, $timeout, $stateParams, $state) {


    async function initializeView(id) {
        try {
            var backup = await SanteDB.resources.backup.getAssociatedAsync("Any", "Descriptor", id);
            var classes = await SanteDB.resources.backup.getAsync("classes");
            backup.assets.forEach(a => a.className = classes[a.classId]);
            $timeout(() => $scope.backup = backup);
        }
        catch(e) {
            $rootScope.errorHandler(e);
        }
    }

    if($stateParams.id) {
        initializeView($stateParams.id);
    }
    else {
        $state.go("santedb-emr.system.backup.index");
    }

}]);