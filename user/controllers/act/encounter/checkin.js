/// <reference path="../../../.ref/js/santedb.js" />
angular.module('santedb').controller('EmrCheckinEncounterController', ["$scope", "$rootScope", "$timeout", function ($scope, $rootScope, $timeout) {

    $scope.patientId = null;
    $scope.$watch("patientId", async function (n, o) {
        if (n && n != o) {
            try {
                var fetchedData = await Promise.all([
                    SanteDB.resources.patient.getAsync(n, "full"),
                    SanteDB.resources.carePlan.findAsync({
                        "participation[RecordTarget].player": n,
                        "relationship[HasComponent].target.actTime": [
                            `>=${moment().add(-10, 'days').format('YYYY-MM-DD')}`,
                            `<=${moment().add(5, 'days').format('YYYY-MM-DD')}`
                        ],
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
                    $scope.newAct = new PatientEncounter();
                    var tArray = fetchedData.filter(d => d.$type == "Bundle" && d.resource && d.resource[0].$type == "CarePlan");
                    if (tArray.length > 0) {
                        $scope._proposedActs = tArray[0].resource.map(cp => {
                            var act = cp.relationship.HasComponent.find(ar => ar.targetModel.actTime >= new Date().addDays(-10) && ar.targetModel.actTime <= new Date().addDays(5)).targetModel;
                            act.pathway = cp.pathway;
                            act.pathwayModel = cp.pathwayModel;
                            return act;
                        });
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

            var submission = new Bundle({ resource: [] });

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

            // Template
            var template = await SanteDB.application.getTemplateContentAsync(templateId, {
                recordTargetId: $scope.recordTarget.id,
                facilityId: await SanteDB.authentication.getCurrentFacilityId(),
                userEntityId: await SanteDB.authentication.getCurrentUserEntityId()
            });

            var encounter = new PatientEncounter(template);
            encounter.relationship = encounter.relationship || {};
            encounter.relationship.HasComponent = encounter.relationship.HasComponent || [];
            encounter.relationship.Fulfills = fulfills;
            // Ensure the appropriate keys are set
            encounter.startTime = encounter.actTime = new Date();
            encounter.statusConcept = StatusKeys.Active;

            // Compute the actions to be performed
            var actions = await SanteDB.resources.patient.invokeOperationAsync($scope.recordTarget.id, "generate-careplan", {
                pathway: pathway,
                encounter: template.templateModel.mnemonic,
                period: moment().format("YYYY-MM-DD")
            }, undefined, "min");

            actions.relationship.HasComponent.forEach(comp => {
                var ar = new ActRelationship({
                    relationshipType: comp.relationshipType,
                    target: comp.target || comp.targetModel.id || SanteDB.application.newGuid(),
                    source: encounter.id
                });
                encounter.relationship.HasComponent.push(ar);
                comp.targetModel.id = comp.targetModel.id || ar.target;

                // Fulfillment for the target model
                if (comp.targetModel && comp.targetModel.protocol) {
                    var fulfillment = fulfillmentTargets.find(o => {
                        var targetAct = o.targetModel;
                        return targetAct.protocol.find(p => comp.targetModel.protocol.find(p2 => p2.protocol == p.protocol && p2.sequence == p.sequence))
                    });
                    if (fulfillment) {
                        comp.targetModel.relationship = comp.targetModel.relationship || {};
                        comp.targetModel.relationship.Fulfills = comp.targetModel.relationship.Fulfills || [];
                        comp.targetModel.relationship.Fulfills.push(new ActRelationship({
                            target: fulfillment.target
                        }));
                    }
                }
                submission.resource.push(comp.targetModel);
            });

            console.info(submission);
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