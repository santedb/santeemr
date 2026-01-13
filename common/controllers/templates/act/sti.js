angular.module("santedb").controller("StiStatusPanelController", ["$scope", "$rootScope", "$timeout",
    function ($scope, $rootScope, $timeout) {

        async function getOrCreateStiPanel(rct) {
            try {
                var stiPanel = await SanteDB.resources.act.findAsync(
                    {
                        "participation[RecordTarget].player": rct,
                        "typeConcept": "32bd992b-9145-4bbf-ac43-19caa95256ed",
                        "statusConcept": StatusKeys.Completed,
                        "_count": 1,
                        "_includeTotal": false
                    },
                    "min"
                );
                var isNew = !panel.resource;

                if (stiPanel.resource) {
                    stiPanel = { id: stiPanel.resource[0].id };
                }
                else {
                    // Otherwise grab the STI template and create it for the record target
                    stiPanel = await SanteDB.application.getTemplateContentAsync("org.santedb.emr.organizer.sti.panel", {
                        recordTargetId: rct,
                        userEntityId: await SanteDB.authentication.getCurrentUserEntityId()
                    }, "min");
                    delete (stiPanel.relationship.HasComponent); // delete the default has component
                }

                $scope.act.relationship = $scope.act.relationship || {};
                $scope.act.relationship.HasComponent = $scope.act.relationship.HasComponent || [];
                $scope.act.relationship.HasComponent.push({
                    source: stiPanel.id,
                    sourceModel: isNew ? panel : false,
                    $insertFirst: true

                });

            }
            catch (e) {
                console.warn("Error assigning STI panel");
            }
        }

        function setupWatchOnDisease(rct) {
            $scope.$watch("act.value", async function (n, o) {
                if (n) {
                    try {
                        var existing = await SanteDB.resources.codedObservation.findAsync({
                            "typeConcept": "08ce33e6-63b8-41f4-89bb-f4faac45e6a2",
                            "value": n,
                            "participation[RecordTarget].player": rct,
                            "relationship[RefersTo].source@CodedObservation.participation[RecordTarget].player": rct,
                            "relationship[RefersTo].source@CodedObservation.typeConcept": "236b5641-61d2-4d12-91f7-5dddbd7f8931",
                            "relationship[RefersTo].source@CodedObservation.statusConcept": StatusKeys.Active,
                            "_count": 1,
                            "_includeTotal": false
                        }, "min");

                        $timeout(() => {
                            $rootScope.getParentVariable($scope, ['ownerForm', 'editForm', 'panel.editForm'])['stiDisease' + $scope.act.id]?.$setValidity("duplicate", !(existing.resource && existing.resource[0].id != $scope.act.id));
                        });
                    }
                    catch (e) {
                        console.warn(e);
                    }
                }
            });
        }

        $scope.$watch("act.id", function (n, o) {
            if (n) //  Initialize the status concept appropriately
            {
                switch ($scope.act.template) {
                    case "6e64e95d-5de0-4664-b42b-5ee346ba892f": // STI Panel
                        $scope.act.statusConcept = StatusKeys.Completed;
                        break;
                    case "30de09e1-5964-48ac-94e0-28bb8f329b46": // Infection - we need to make sure this is part of a panel
                        var rct = $scope.act.participation?.RecordTarget[0]?.player;
                        if (rct) {
                            if ($scope.act.tag?.$userAdded) {
                                getOrCreateStiPanel(rct);
                            }
                            setupWatchOnDisease(rct);
                        }
                        break;
                }
            }
        });


        $scope.addStiToPanel = async function () {
            try {
                SanteDB.display.buttonWait("#btnAddSti", true);
                var template = await SanteDB.application.getTemplateContentAsync("org.santedb.emr.act.sti.infection", {
                    "recordTargetId": $scope.act.participation?.RecordTarget[0]?.player
                });
                $timeout(() => {
                    $scope.act.relationship.HasComponent.push(new ActRelationship({
                        targetModel: template
                    }))
                });
            }
            catch (e) {
                $rootScope.errorHandler(e);
            }
            finally {
                SanteDB.display.buttonWait("#btnAddSti", false);
            }
        }

        $scope.removeStiFromPanel = function (comp) {
            if (comp.targetModel.version) { // already saved so we remove
                comp.targetModel.statusConcept = 'bdef5f90-5497-4f26-956c-8f818cce2bd2';
                comp.operation = 4;
            }
            else // not saved so we splice
            {
                var idx = $scope.act.relationship.HasComponent.findIndex(r => r.targetModel.id == comp.targetModel.id || r.target == comp.target);
                if (idx >= 0) {
                    $scope.act.relationship.HasComponent.splice(idx, 1);
                }
            }
        }

        $scope.undoRemoveStiFromPanel = function (comp) {
            comp.targetModel.statusConcept = 'afc33800-8225-4061-b168-bacc09cdbae3';
            comp.operation = 2;
        }
    }
]);