/// <reference path="../../../.ref/js/santedb.js"/>
angular.module("santedb").controller("EmrPatientFacilityController", ["$scope", "$rootScope", "$timeout", "$state", function ($scope, $rootScope, $timeout, $state) {

    $scope.$watch("editObject", (n, o) => {
        if (n) {
            n.relationship.IncidentalServiceDeliveryLocation = n.relationship.IncidentalServiceDeliveryLocation || [];
        }
    });

    $scope.savePatientFacilities = async function (form) {
        if (form.$invalid) {
            return;
        }

        try {
            // Collect the relationships that have changed
            var scopedObjectFacilities = [
                $scope.scopedObject.relationship.DedicatedServiceDeliveryLocation,
                $scope.scopedObject.relationship.IncidentalServiceDeliveryLocation
            ].flat().filter(o => o);
            var editObjectFacilities = [
                $scope.editObject.relationship.DedicatedServiceDeliveryLocation?.map(o => { o.relationshipType = EntityRelationshipTypeKeys.DedicatedServiceDeliveryLocation; return o }),
                $scope.editObject.relationship.IncidentalServiceDeliveryLocation?.map(o => { o.relationshipType = EntityRelationshipTypeKeys.IncidentalServiceDeliveryLocation; return o })
            ].flat().filter(o => o);


            // Delete any removed
            var removedFacilities = scopedObjectFacilities.filter(o => !editObjectFacilities.find(e => e.target == o.target && e.relationshipType == o.relationshipType)).map(o => {
                return new EntityRelationship({
                    id: o.id,
                    operation: BatchOperationType.Delete
                });
            });
            var addedFacilities = editObjectFacilities.filter(o => !scopedObjectFacilities.find(e => e.target == o.target && e.relationshipType == o.relationshipType)).map(o => {
                return new EntityRelationship({
                    operation: BatchOperationType.InsertOrUpdate,
                    holder: $scope.editObject.id,
                    relationshipType: o.relationshipType,
                    target: o.target
                });
            })

            // Bundle the data 
            var submissionBundle = new Bundle({ resource: [addedFacilities, removedFacilities].flat().filter(o => o) });
            if (submissionBundle.resource?.length > 0) {
                await SanteDB.resources.bundle.insertAsync(submissionBundle, null, null, true);
                toastr.success(SanteDB.locale.getString("ui.model.patient.saveSuccess"));
                $state.reload();
            }
        }
        catch (e) {
            $rootScope.errorHandler(e);
        }
    }

}]);