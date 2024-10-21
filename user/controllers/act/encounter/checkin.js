/// <reference path="../../../.ref/js/santedb.js" />
angular.module('santedb').controller('EmrCheckinEncounterController', ["$scope", "$rootScope", "$timeout", "$state", function ($scope, $rootScope, $timeout, $state) {

    $scope.patientId = null;
    $scope.$watch("patientId", async function (n, o) {
        if (n && n != o) {
            try {
                var fetchedData = await Promise.all([
                    SanteDB.resources.patient.getAsync(n, "full"),
                    SanteDB.resources.carePlan.findAsync({
                        "participation[RecordTarget].player": n,
                        "relationship[HasComponent].target.actTime": [
                            `>=${moment().add(-15, 'days').format('YYYY-MM-DD')}`,
                            `<=${moment().add(10, 'days').format('YYYY-MM-DD')}`
                        ],
                        _orderBy: "actTime:desc",
                        _includeTotal: false
                    }, 'full'),
                    SanteDB.resources.patientEncounter.findAsync({
                        "participation[RecordTarget].player": n,
                        moodConcept: ActMoodKeys.Appointment,
                        _count: 1,
                        actTime: `~${moment().format('YYYY-MM-DD')}`,
                        _includeTotal: false
                    })
                ]);

                $timeout(() => {
                    $scope.recordTarget = new Patient(fetchedData.find(d => d.$type == "Patient"));
                    var pid = SanteDB.application.newGuid();
                    $scope.newAct = new PatientEncounter({
                        participation: {
                            Informant: [
                                {
                                    playerModel: new Person({
                                        id: pid,
                                        relationship:
                                        {
                                            $other: [
                                                { 
                                                    relationshipType: EntityRelationshipTypeKeys.FamilyMember,
                                                    source: $scope.recordTarget.id,
                                                    target: pid
                                                }
                                            ]
                                        },
                                        name: {
                                            Assigned: [
                                                {
                                                    component: {
                                                        "Given": []
                                                    }
                                                }
                                            ]
                                        }
                                    })
                                }
                            ]
                        }
                    });
                    var tArray = fetchedData.filter(d => d.$type == "Bundle" && d.resource && d.resource[0].$type == "CarePlan");
                    if (tArray.length > 0) {
                        $scope._proposedActs = tArray[0].resource.map(cp => {
                            var act = cp.relationship.HasComponent.find(ar => ar.targetModel.actTime >= new Date().addDays(-15) && ar.targetModel.actTime <= new Date().addDays(10)).targetModel;
                            act.pathway = cp.pathway;
                            act.pathwayModel = cp.pathwayModel;
                            return act;
                        });
                    }
                    else {
                        $scope._proposedActs = [];
                    }
                    tArray = fetchedData.filter(d => d.$type == "Bundle" && d.resource && d.resource[0].moodConcept == ActMoodKeys.Appointment);
                    if (tArray.length > 0) {
                        $scope._appointmentAct = new PatientEncounter(tArray[0].resource[0]);
                    }
                    $scope.newAct.$startType = 'manual';
                });
            }
            catch (e) {
                $rootScope.errorHandler(e);
            }
        }
    });

    async function saveCheckin(formData) {
        if (formData.$invalid) {
            return;
        }

        try {
            SanteDB.display.buttonWait("#btnSubmit", true);

            var templateId = null;
            var pathway = null;
            var startTypeData = $scope.newAct.$startType.split('-');
            var fulfills = [];
            var fulfillmentTargets = [];

            switch (startTypeData[0]) {
                case "manual":
                    templateId = $scope.newAct.template;
                    break;
                case "proposed":
                    {
                        var idx = parseInt(startTypeData[1]);
                        pathway = $scope._proposedActs[idx].pathway;
                        templateId = $scope._proposedActs[idx].templateModel.mnemonic;
                        fulfills.push(new ActRelationship({
                            target: $scope._proposedActs[idx].id
                        }));
                        fulfillmentTargets = $scope._proposedActs[idx].relationship.HasComponent.map(o => new ActRelationship({
                            target: o.target,
                            targetModel: {
                                $type: o.targetModel.$type,
                                protocol: o.targetModel.protocol
                            }
                        }));
                        break;
                    }

            }

            var encounter = await SanteEMR.startVisitAsync(templateId, pathway, $scope.recordTarget.id, fulfills, fulfillmentTargets, $scope.newAct.participation.Informant[0]);
            toastr.success(SanteDB.locale.getString("ui.emr.encounter.checkin.success"));
            $state.go("santedb-emr.encounter.view", { id: encounter.id });
        }
        catch (e) {
            $rootScope.errorHandler(e);
        }
        finally {
            SanteDB.display.buttonWait("#btnSubmit", false);
        }
    }

    $scope.applyGuardExpression = function (data) {
        if (data.guard) {
            return $scope.$eval(data.guard, { recordTarget: $scope.recordTarget });
        }
        return true;
    }

    $scope.resolveTemplateIcon = SanteEMR.resolveTemplateIcon;
    $scope.resolveSummaryTemplate = SanteEMR.resolveSummaryTemplate;
    $scope.saveCheckin = saveCheckin;

    $("#checkinModal").on("hidden.bs.modal", function () {
        $timeout(() => {
            $scope.patientId = "";
            delete ($scope.recordTarget);
            delete ($scope.encounter);
        });
    });


}]);