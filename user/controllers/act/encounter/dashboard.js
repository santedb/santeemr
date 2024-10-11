/// <reference path="../../../.ref/js/santedb.js" />
angular.module('santedb').controller('EmrEncounterDashboardController', ["$scope", "$rootScope", "$timeout", "$state", function ($scope, $rootScope, $timeout, $state) {
}]).controller("EmrWaitingRoomController", ["$scope", "$rootScope", "$timeout", "$state", function($scope, $rootScope, $timeout, $state) {

    async function cancelEncounter(encounterId) {
        if(confirm(SanteDB.locale.getString("ui.emr.encounter.cancel.confirm"))) {
            try {
                
                var submissionBundle = new Bundle({resource: []});
                submissionBundle.resource.push(new PatientEncounter({
                    id: encounterId, 
                    operation: BatchOperationType.Delete
                }));

                var component = await SanteDB.resources.actRelationship.findAsync({
                    "source": encounterId,
                    "relationshipType": ActRelationshipTypeKeys.HasComponent
                });

                if(component.resource) {
                    component.resource.forEach(c => submissionBundle.resource.push(new Act({
                        id: c.target,
                        operation: BatchOperationType.Delete
                    })));
                }

                await SanteDB.resources.bundle.insertAsync(submissionBundle);
                $("#waitingRoomList").EntityList.refresh();
                toastr.success(SanteDB.locale.getString("ui.emr.encounter.cancel.success"));

            }
            catch(e) {
                $rootScope.errorHandler(e);
            }
        }
    }

    $scope.doCancel = cancelEncounter;
}])