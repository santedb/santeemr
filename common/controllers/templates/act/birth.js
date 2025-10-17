/// <Reference path="../../../.ref/js/santedb.js" />
/// <Reference path="../../../.ref/js/santedb-model.js" />
angular.module('santedb').controller('BirthRegistrationController', [ "$scope", "$rootScope", function($scope, $rootScope) {

    // Find the birth delivery outcome of this action
    $scope.findBirthDeliveryOutcome = () => $scope.act.relationship?.HasComponent.find(c=>c.targetModel?.typeConcept == 'dddf18e4-1868-11eb-adc1-0242ac120002')?.targetModel;
    $scope.findBirthDeliveryDate = () => $scope.act.relationship?.HasComponent.find(c=>c.targetModel?.typeConcept == '409538df-26e0-4ffa-b9fc-11a244eae0e5')?.targetModel;
    $scope.findBirthSex = () => $scope.act.relationship?.HasComponent.find(c=>c.targetModel?.typeConcept == 'e1cf0ea0-63bf-4a8c-9e41-bbd542d3479c')?.targetModel;

    // We want to ensure that the baby is referenced via memory so each update flows to all components in the model!
    function cascadeBabyParticipation() {
        var baby = $scope.act.participation.Baby[0].playerModel;
        // Ensure the baby is updated 
        baby.operation = BatchOperationType.InsertOrUpdate;
        // Each record target which is the baby
        $scope.act.relationship.HasComponent.forEach(cmp => {

            if(cmp.targetModel?.participation && 
                cmp.targetModel?.participation.RecordTarget &&
                (
                    cmp.targetModel?.participation.RecordTarget[0].playerModel?.id == baby.id ||
                    cmp.targetModel?.participation.RecordTarget[0].player == baby.id
                )
             ) {
                cmp.targetModel.participation.RecordTarget[0].playerModel = baby;
            }
        })
    }

    function updateBabyObservationsOperation(batchOperation) {
        $scope.act.relationship.HasComponent.forEach(cmp => {
            var baby = $scope.act.participation.Baby[0].playerModel;

            if(cmp.targetModel?.participation && 
                cmp.targetModel?.participation.RecordTarget &&
                (
                    cmp.targetModel?.participation.RecordTarget[0].playerModel?.id == baby.id ||
                    cmp.targetModel?.participation.RecordTarget[0].player == baby.id
                )
            ) {
                cmp.operation = cmp.targetModel.operation = batchOperation;
            }
        })
    }

    // Cascade time of delivery to bithdate
    $scope.$watch((s) => s.findBirthDeliveryDate()?.value, function(n, o) {
        if(n != o) {
            $scope.act.participation.Baby[0].playerModel.dateOfBirth = n;
        }
    });

    // Cascade time of delivery to bithdate
    $scope.$watch((s) => s.findBirthSex()?.value, function(n, o) {
        if(n != o && 
            $scope.act.participation?.Baby[0].playerModel
        ) {
            $scope.act.participation.Baby[0].playerModel.genderConcept = n;
        }
    });

    $scope.$watch("act.statusConcept", async function(n, o) {
        if(!$scope.act.version && n && n == StatusKeys.Completed) {
            // Is there an active visit for the BABY?
            var baby = $scope.act.participation.Baby[0].playerModel;
            /** @type {Bundle} */
            var existingEncounter = await SanteDB.resources.patientEncounter.findAsync({
                "typeConcept" : "48bf3525-3fad-4fca-9d17-4f93f88f4d71", // Neonatal
                "participation[RecordTarget].player" : baby.id,
                _count: 0,
                _includeTotal: true
            });

            if(existingEncounter.totalResults == 0 && confirm(SanteDB.locale.getString("ui.emr.patient.birth.checkInNeonate"))) {
                
            }
        }
    });

    $scope.$watch((s) => s.findBirthDeliveryOutcome()?.value, function(n, o) {
        if(n === "023859e6-1867-11eb-adc1-0242ac120002") {
            $scope.act.participation.Baby[0].playerModel.deceasedDate = $scope.act.participation.Baby[0].playerModel.dateOfBirth = $scope.findBirthDeliveryDate().value;
            // Throw the baby record away - as there is no point in storing the record of demographics - just the record of the stillbirth (against the mother)
            $scope.act.participation.Baby[0].operation = $scope.act.participation.Baby[0].playerModel.operation = BatchOperationType.Delete;
            // All acts that have the BABY as their record target there is no requirement to capture - mark them as DELETE
            updateBabyObservationsOperation(BatchOperationType.Delete);
        }
        else {
            delete $scope.act.participation.Baby[0].playerModel.deceasedDate;
            $scope.act.participation.Baby[0].operation = $scope.act.participation.Baby[0].playerModel.operation = BatchOperationType.InsertOrUpdate;
            updateBabyObservationsOperation(BatchOperationType.InsertOrUpdate);
        }
    });

    applyCascadeInstructions($scope.act);
    cascadeBabyParticipation();
}]);