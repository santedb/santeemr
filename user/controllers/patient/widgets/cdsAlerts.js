/// <reference path="../../../.ref/js/santedb.js"/>
angular.module("santedb").controller("EmrPatientCdsAlertsController", ["$scope", "$rootScope", "$timeout", function($scope, $rootScope, $timeout) {

    async function initializeView(id){
        try {
            var issues = await SanteDB.resources.patient.invokeOperationAsync(id, "analyze", { _excludePropose: true });
            var issueTypes = {};
            issues.issue.forEach(o=> issueTypes[o.type] = null);
            await Promise.all(
                Object.keys(issueTypes).map(async (f) => {
                    var concept = await SanteDB.resources.concept.getAsync(f === EmptyGuid ? '1a4ff986-f54f-11e8-8eb2-f2801f1b9fd1' : f);
                    issues.issue.filter(i => i.type === f).forEach(i => i.typeModel = concept);
                    return concept;
                })
            );

            $timeout(() => {
                $scope.issues = issues.issue.filter(i => i.id !== "error.cdss.exception");
            });
        }
        catch(e) {
            $rootScope.errorHandler(e);
        }
    }

    initializeView($scope.scopedObject.id);
}])