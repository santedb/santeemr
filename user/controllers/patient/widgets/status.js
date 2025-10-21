/// <reference path="../../../.ref/js/santedb.js"/>
/// <reference path="../../../.ref/js/santedb-model.js"/>
angular.module('santedb').controller('EmrPatientStatusWidgetController', ['$scope', '$rootScope', '$timeout', "$state", function ($scope, $rootScope, $timeout, $state) {

    async function initializeView() {
        try {
            // Expand the conditions 
            const conditionCodes = await SanteDB.resources.conceptSet.invokeOperationAsync("2b3e26bc-5766-4e84-afac-a522edc2e7e3", "expand", {}, null, "min");
            const results = await SanteDB.resources.act.findAsync({
                "participation[RecordTarget].player": $scope.scopedObject.id,
                "typeConcept.conceptSet": "b73e6dbc-890a-11f0-8959-c764088c39f9", // Is a condition
                "statusConcept": StatusKeys.Completed, // Is not obsolete
                "moodConcept" : ActMoodKeys.Eventoccurrence
            }, "full");

            // Any observation in the 
            results.resource?.filter(obs => conditionCodes.resource.map(o => o.id).includes(obs.typeConcept)).forEach(obs => {
                obs.tag = obs.tag || {};
                obs.tag["$isCondition"] = true;
            });

            $timeout(() => {
                $scope.statusObservations = results.resource;
            })
        }
        catch (e) {
            $rootScope.errorHandler(e);
        }
    }

    initializeView();

    $scope.resolveSummaryTemplate = SanteEMR.resolveSummaryTemplate;
    $scope.resolveTemplateForm = SanteEMR.resolveTemplateForm;
    $scope.resolveTemplateIcon = SanteEMR.resolveTemplateIcon;
    $scope.getTemplateName = function (templateId) {
        return SanteDB.application.getTemplateMetadata(templateId)?.name || templateId;
    }
    
    // When the user clicks edit - we want to create an amendment observation for ecah of the observations
    $scope.$watch("panel.view", function (n, o) {
        if (n == "Edit") {
            $scope.amendmentObservations = angular.copy($scope.statusObservations);
        }
        else {
            delete $scope.amendmentObservations;
        }
    });

    // Save the status observations 
    $scope.updateStatusObservations = async function(form) {
        if(form.$invalid) {
            return;
        }
        try {
            var submissionBundle = new Bundle({ resource: [] });
            var newObservations = angular.copy($scope.amendmentObservations);
            for(var i in newObservations) {
                // If the user has indicated somehow the data is not complete ignore it and furthermore
                // delete the previous observation
                var amendment = newObservations[i];
                amendment.tag = amendment.tag || {};
                amendment.tag["emr.processed"] = ["false"];
                amendment.operation = BatchOperationType.Update;
                if(
                    amendment.statusConcept == StatusKeys.Completed || 
                    amendment.statusConcept == StatusKeys.Active
                ) // Completed the observation - so we update the data
                {
                    amendment.statusConcept = StatusKeys.Completed; // Observation is complete
                    submissionBundle.resource.push(await prepareActForSubmission(amendment));
                }
                else { // Remove the subsmission
                    amendment.statusConcept = StatusKeys.Obsolete;
                    amendment.id = amendment._original; // Update the original to set it to obsolete
                    amendment.operation = BatchOperationType.Update; // Update the original 
                    delete amendment.relationship;
                    delete amendment.note;
                    submissionBundle.resource.push(amendment);
                }
                bundleRelatedObjects(amendment, null, submissionBundle);
            }
            const result = await SanteDB.resources.bundle.insertAsync(submissionBundle);
            toastr.success(SanteDB.locale.getString("ui.emr.patient.status.update.success"));
            $state.reload();
        }
        catch(e) {
            $rootScope.errorHandler(e);
        }
    }
}]);
