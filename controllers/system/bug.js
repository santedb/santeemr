/// <reference path="../../.ref/js/santedb.js"/>
/// <reference path="../../.ref/js/santedb-model.js"/>
angular.module('santedb').controller('SubmitBugController', ["$scope", "$rootScope", "$state", function($scope, $rootScope, $state) {

    $scope.info = {};
    $scope.report = {
        attachLog: true,
        attachConfig: true
    };

    // Initialize the view
    async function initialize() {
        try {
            var logs = await SanteDB.application.getLogInfoAsync();
            if(logs.resource) {
                var log = logs.resource.find(o=>o.name == "SanteDB.log");
                $scope.info.logSize = Math.round(log.size / 1024);
            }
            $scope.$apply();
        }
        catch(e) {

        }
    }

    initialize();

    // Submit the bug report
    $scope.submitBug = async function(form) {

        if(!form.$valid) return;

        try{
            SanteDB.display.buttonWait("#btnSubmitBug", true);
            var noteText = `## Note \r\n ${$scope.report.description} \r\n ## Steps to Reproduce\r\n ${$scope.report.reproduction}`;
            
            var submission = {
                $type: "DiagnosticReport",
                note: noteText,
                attach: []
            };
            if($scope.report.attachConfig)
                submission.attach.push({ file: "SanteDB.config" });
            if($scope.report.attachLog)
                submission.attach.push({ file: "SanteDB.log" });
                
            var result = await SanteDB.application.submitBugReportAsync(submission);
            toastr.info(`${SanteDB.locale.getString("ui.emr.bug.success")} #${result.ticketId}`, null, { preventDuplicates: true });
            $state.transitionTo("santedb-emr.dashboard");
        }
        catch(e) {
            $rootScope.errorHandler(e);
        }
        finally {
            SanteDB.display.buttonWait("#btnSubmitBug", false);

        }

    }   
}]);