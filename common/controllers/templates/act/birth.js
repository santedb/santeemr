/// <Reference path="../../../.ref/js/santedb.js" />
/// <Reference path="../../../.ref/js/santedb-model.js" />
/// <Reference path="../../../../user/js/emr.js" />

angular.module('santedb').controller('BirthRegistrationController', ["$scope", "$rootScope", "$timeout", "$stateParams", function ($scope, $rootScope, $timeout, $stateParams) {

    const STILLBIRTH_OBS = ["org.santedb.emr.observation.birthSex", "org.santedb.emr.observation.birthWeight"]
    const NEONATAL = ["org.santedb.emr.act.visit.neonatal"];


    // Find the birth delivery outcome of this action
    $scope.findBirthDeliveryOutcome = () => $scope.act.relationship?.HasComponent.find(c => c.targetModel?.typeConcept == 'dddf18e4-1868-11eb-adc1-0242ac120002')?.targetModel;
    $scope.findBirthDeliveryDate = () => $scope.act.relationship?.HasComponent.find(c => c.targetModel?.typeConcept == '409538df-26e0-4ffa-b9fc-11a244eae0e5')?.targetModel;
    $scope.findBirthSex = () => $scope.act.relationship?.HasComponent.find(c => c.targetModel?.typeConcept == 'e1cf0ea0-63bf-4a8c-9e41-bbd542d3479c')?.targetModel;

    // We want to ensure that the baby is referenced via memory so each update flows to all components in the model!
    async function initializeTemplateView() {
        if (!$scope ||
            !$scope.act ||
            !$scope.act.participation ||
            !$scope.act.participation.Baby
        ) {
            return;
        }

        var baby = $scope.act.participation.Baby[0].playerModel;
        // JIMS-1026 - Is the baby player model not present
        if(!baby) {
            var baby = await SanteDB.resources.person.getAsync($scope.act.participation.Baby[0].player);
        }
        
        // Ensure the baby is updated 
        baby.operation = BatchOperationType.InsertOrUpdate;

        // Check if baby has a neonatal encounter
        var neonate = await SanteDB.resources.patientEncounter.findAsync({
            "participation[RecordTarget].player": baby.id,
            "statusConcept": StatusKeys.Active,
            "moodConcept": ActMoodKeys.Eventoccurrence,
            "_count": 1,
            "_includeTotal": false
        }, "min");

        $timeout(() => {
            if (neonate.resource) {
                $scope.neoNatalEncounterId = neonate.resource[0].id;
            }

            // Each record target which is the baby
            $scope.act.relationship.HasComponent.forEach(cmp => {

                if (cmp.targetModel?.participation &&
                    cmp.targetModel?.participation.RecordTarget &&
                    (
                        cmp.targetModel?.participation.RecordTarget[0].playerModel?.id == baby.id ||
                        cmp.targetModel?.participation.RecordTarget[0].player == baby.id
                    )
                ) {
                    cmp.targetModel.participation.RecordTarget[0].playerModel = baby;
                }
            });
        });
    }

    
    function updateBabyObservationsOperation(batchOperation) {
        if (!$scope ||
            !$scope.act ||
            !$scope.act.participation ||
            !$scope.act.participation.Baby
        ) {
            return;
        }

        $scope.act.relationship.HasComponent.forEach(cmp => {
            var baby = $scope.act.participation.Baby[0].playerModel;
            baby.operation = batchOperation;
            if (cmp.targetModel?.participation &&
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
    $scope.$watch((s) => s.findBirthDeliveryDate()?.value, function (n, o) {
        if (n != o) {
            $scope.act.participation.Baby[0].playerModel.dateOfBirth = n;
        }
    });

    // Cascade time of delivery to bithdate
    $scope.$watch((s) => s.findBirthSex()?.value, function (n, o) {
        if (n != o &&
            $scope.act.participation?.Baby[0].playerModel
        ) {
            $scope.act.participation.Baby[0].playerModel.genderConcept = n;
        }
    });

    $scope.startNeonatalEncounter = async function () {
        try {

            SanteDB.display.buttonWait("#btnStartNeonateVisit", true);
            // Get all components for the baby 
            var baby = $scope.act.participation.Baby[0].playerModel;
            var mother = $scope.act.participation.RecordTarget[0].playerModel;

            // Is this part of a list of encounters? - if so this is the same
            var list = await SanteDB.resources.act.findAsync({
                "statusConcept": StatusKeys.Active,
                "classConcept": ActClassKeys.List,
                "relationship[HasComponent].target": $scope.act._getEncounter()?.id,
                _count: 1,
                _includeTotal: false
            }, "min");

            var babyComponents = $scope.act.relationship.HasComponent?.filter(o => o && o.targetModel && o.targetModel.participation?.RecordTarget && o.targetModel.participation?.RecordTarget[0].player == baby.id).map(o => o.targetModel?.id || o.target);
            var visit = await SanteEMR.startVisitAsync(NEONATAL, null, baby.id, null, null, new ActParticipation({ player: mother.id }), 
                {
                    relationship: {
                        HasComponent: list.resource?.map(o => new ActRelationship({ source: o.id }))
                    }
                }, null, {
                birthEncounterActionsForBaby: babyComponents.join(",")
            });

            $timeout(() => $scope.neoNatalEncounterId = visit.id);
        }
        catch (e) {
            $rootScope.errorHandler(e);
        }
        finally {
            SanteDB.display.buttonWait("#btnStartNeonateVisit", false);
        }
    }

    $scope.$watch((s) => s.findBirthDeliveryOutcome()?.value, async function (n, o) {
        if (n === "023859e6-1867-11eb-adc1-0242ac120002") {

            if ($scope.act.participation.Baby) {
                // Add birth weight and birth sex & weight observations to the data
                var templateData = await Promise.all(STILLBIRTH_OBS.map(async function (tpl) {
                    try {
                        var templateData = await SanteDB.application.getTemplateContentAsync(tpl, {
                            recordTargetId: $scope.act.participation.RecordTarget[0].player,
                            facilityId: $scope.act.participation.Location[0].player,
                            userEntityId: await SanteDB.authentication.getCurrentUserEntityId()
                        });

                        delete templateData.participation?.RecordTarget;
                        return templateData;
                    } catch (e) {
                        console.error(e);
                    }
                }));


                $timeout(() => {

                    templateData.forEach(tpl => {
                        $scope.act.relationship.HasComponent.push({
                            targetModel: tpl,
                            _shouldDeleteOnSb: true
                        });
                    });

                    $scope.act.participation.Baby[0].playerModel.deceasedDate = $scope.act.participation.Baby[0].playerModel.dateOfBirth = $scope.findBirthDeliveryDate().value;
                    // Throw the baby record away - as there is no point in storing the record of demographics - just the record of the stillbirth (against the mother)
                    // Any observations for the 
                    $scope.act.participation.Baby[0].operation = $scope.act.participation.Baby[0].playerModel.operation = BatchOperationType.Delete;
                    // All acts that have the BABY as their record target there is no requirement to capture - mark them as DELETE
                    updateBabyObservationsOperation(BatchOperationType.Delete);
                });
            }
        }
        else if ($scope.act.participation.Baby) {
            $timeout(() => {
               
                $scope.act.relationship.HasComponent = $scope.act.relationship.HasComponent.filter(o => !o._shouldDeleteOnSb);
                $scope.act.participation.Baby[0].operation = $scope.act.participation.Baby[0].playerModel.operation = BatchOperationType.InsertOrUpdate;
                updateBabyObservationsOperation(BatchOperationType.InsertOrUpdate);
            });
        }
    });

    applyCascadeInstructions($scope.act);
    initializeTemplateView();
}]).controller("EmrBirthRegistrationViewController", ["$scope", "$rootScope", "$timeout", "$state", function ($scope, $rootScope, $timeout, $state) {
    $scope.resolveSummary = $scope.resolveSummaryTemplate = SanteEMR.resolveSummaryTemplate;

    async function init() {
        const act = await SanteDB.resources.act.getAsync($scope.act.id, "emr.actDetail");

        $scope.act = act;
    }

    init();
}]);
