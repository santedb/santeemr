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

                if (stiPanel.resource) {
                    stiPanel = { id: stiPanel.resource[0].id };
                }
                else {
                    // Otherwise grab the STI template and create it for the record target
                    stiPanel = await SanteDB.application.getTemplateContentAsync("org.santedb.emr.organizer.sti.panel", {
                        recordTarget: rct,
                        userEntityId: await SanteDB.authentication.getCurrentUserEntityId()
                    }, "min");
                    delete (stiPanel.relationship.HasComponent); // delete the default has component
                }

                $scope.act.relationship = $scope.act.relationship || {};
                $scope.act.relationship.HasComponent = $scope.act.relationship.HasComponent || [];
                $scope.act.relationship.HasComponent.push(new ActRelationship({
                    source: stiPanel.id,
                    sourceModel: stiPanel
                }));

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
                            "typeConcept" : "08ce33e6-63b8-41f4-89bb-f4faac45e6a2",
                            "value" : n, 
                            "relationship[RefersTo].source@CodedObservation.participation[RecordTarget].player": rct,
                            "relationship[RefersTo].source@CodedObservation.typeConcept": "236b5641-61d2-4d12-91f7-5dddbd7f8931",
                            "relationship[RefersTo].source@CodedObservation.statusConcept": StatusKeys.Active,
                            "_count": 1,
                            "_includeTotal": false
                        }, "min");

                        $timeout(() => {
                            $rootScope.getParentVariable($scope, 'ownerForm').stiDisease.$setValidity("duplicate", !(existing.resource && existing.resource[0].id != $scope.act.id));
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

    }
]);