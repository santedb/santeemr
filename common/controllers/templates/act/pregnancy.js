angular.module('santedb').controller("PregnancyHistoryController", ["$scope", "$timeout", "$stateParams", function ($scope, $timeout, $stateParams) {

    async function initializeView(act) {
        try {
            // Attempt to find the existing history if it exists
            var existingHistory = await SanteDB.resources.act.findAsync({
                "typeConcept": "04d5b5e8-570e-4244-805a-e448978a19bd",
                "statusConcept": "!BDEF5F90-5497-4F26-956C-8F818CCE2BD2",
                "classConcept": "d38091b5-9065-4721-8a1f-bfbb3b4bf447",
                "participation[RecordTarget].player": act.participation?.RecordTarget[0].player,
                "_orderBy": "actTime:desc",
                "_count": 1,
                "_includeTotal": false
            }, "full");

            if (!existingHistory.resource) {
                return;
            }

            existingHistory = existingHistory.resource[0];

            // Find the history act on our act
            var historyAct = act.relationship?.HasComponent?.find(o => o.targetModel.typeConcept == "04d5b5e8-570e-4244-805a-e448978a19bd")?.targetModel || act;
            if (historyAct?.typeConcept != "04d5b5e8-570e-4244-805a-e448978a19bd") {
                return; // not a pregnancy history
            }

            // Populate the episode link if needed
            if (act.relationship?.RefersTo && 
                !$scope.$eval("act.relationship?.RefersTo[0].target")
            ) {
                SanteDB.resources.act.findAsync({
                    "typeConcept": "7bb3403e-d8ee-4b91-8a77-64da4f459415",
                    "isNegated": false,
                    "statusConcept": "!BDEF5F90-5497-4F26-956C-8F818CCE2BD2",
                    "valueConcept": ["9d93339c-1cdf-4b7b-9652-54fecfc030d9", "032d6f02-48cf-451d-a66a-36ac2fec2454", "0d934588-4bec-49b7-9e3f-1266cf8b4195"],
                    "_orderBy": "actTime:desc",
                    "_count": 1,
                    "_includeTotal": false
                }, "min").then((status) => {
                    if (status.resource) {
                        act.relationship.RefersTo = [new ActRelationship({ target: status.resource[0].id })] // refers to this pregnancy if present
                    }
                });
            }
            // Determine if the current act has a delivery outcome and use that as our delivery outcome
            if(act.typeConcept == '983152a6-be28-4fc0-9c60-63e7178060f7' && $stateParams.id && !act.value) {
                SanteDB.resources.codedObservation.findAsync({
                    "typeConcept" : "dddf18e4-1868-11eb-adc1-0242ac120002",
                    "relationship[HasComponent].source.relationship[HasComponent].source.relationship[HasComponent].source" : $stateParams.id,
                    "statusConcept" : StatusKeys.Completed,
                    "_count" : 1, 
                    "_includeTotal" : false
                }, "min").then((obs) => {
                    $timeout(()=> act.value = obs.value)
                });
            }

            historyAct.statusConcept = StatusKeys.Completed;
            $timeout(() => {
                // Find the component acts 
                existingHistory.relationship?.HasComponent?.forEach(h => {
                    var newObs = historyAct.relationship?.HasComponent?.find(o => o.targetModel.typeConcept == h.targetModel.typeConcept);
                    if (newObs) {
                        newObs.targetModel.value = h.targetModel.value
                    }
                });
            });
        }
        catch (e) {
            console.error("Error computing existing pregnancy history", e);
        }
    }

    initializeView($scope.act);
}]);