/// <reference path="../../../.ref/js/santedb.js"/>
angular.module('santedb').controller('EmrPatientCarePlanController', ['$scope', '$timeout', '$rootScope', "$state", function ($scope, $timeout, $rootScope, $state) {


    async function initializeView(patientId) {
        try {
            var carePathways = await SanteDB.resources.patient.invokeOperationAsync(patientId, "carepath-eligibilty");
            var enrolledCarePathways = await SanteDB.resources.patient.findAssociatedAsync(patientId, "carepaths");

            carePathways.forEach(cp => {
                if (enrolledCarePathways.resource && enrolledCarePathways.resource.find(o => o.id == cp.id || o.pathway == cp.id)) {
                    cp._enrolled = true;
                }
            })
            $timeout(() => {
                $scope.carePathways = carePathways;
            });
        }
        catch (e) {
            $rootScope.errorHandler(e);
        }
    }

    async function fetchNextEncounters(path, monthLimit, limit, force) {
        try {
            if (path.encounters && !force) {
                return;
            }
            else {

                var filter = {
                    moodConcept: [ ActMoodKeys.Propose, ActMoodKeys.Eventoccurrence ],
                    'relationship[HasComponent].source@CarePlan.pathway||relationship[Fulfills].target.relationship[HasComponent].source@CarePlan.pathway': path.id,
                    'participation[RecordTarget].player': $scope.scopedObject.id,
                    'statusConcept': [ StatusKeys.New, StatusKeys.Active ],
                    'actTime': [],
                    _orderBy: 'actTime:asc',
                    _includeTotal: false,
                    _count: limit
                };

                if (monthLimit) {
                    for (var mo = -monthLimit; mo <= monthLimit; mo++) {
                        filter.actTime.push(`~${moment().add(mo, 'month').format('YYYY-MM')}`);
                    }
                }

                var encounters = await SanteDB.resources.patientEncounter.findAsync(filter, "full");
                var proposed = [], event = [];
                if(encounters.resource) {
                    proposed = encounters.resource.filter(r => r.moodConcept == ActMoodKeys.Propose);
                    event = encounters.resource.find(r => r.moodConcept == ActMoodKeys.Eventoccurrence);

                    if(event && event.relationship && event.relationship.Fulfills) {
                        var fulfilled = proposed.find(p => p.id == event.relationship.Fulfills[0].target);
                        if(fulfilled) {
                            fulfilled.relationship = fulfilled.relationship || {};
                            fulfilled.relationship.Fulfills = fulfilled.relationship.Fulfills || [];
                            fulfilled.relationship.Fulfills.push(new EntityRelationship({
                                source: event.id,
                                target: fulfilled.id
                            }));

                            // Block starting all encounters
                            proposed.forEach(p=>{
                                p.tag = p.tag || {};
                                p.tag["$nostart"] = [true];
                            });
                        }
                    }
                }
                
                filter._count = 0;
                filter._includeTotal = true;
                delete filter.actTime;
                var count = await SanteDB.resources.patientEncounter.findAsync(filter);

                // TODO: Find out whether the encounter is currently ongoing -- 
                $timeout(() => {
                    path.encounters = proposed;
                    path._totalEncounters = count.totalResults;
                });
            }
        }
        catch (e) {
            $rootScope.errorHandler(e);
        }
    }

    async function unenroll(pathway, idx) {
        if (confirm(SanteDB.locale.getString("ui.emr.patient.carePaths.unenroll.confirm", { pathway: pathway.name }))) {
            try {
                SanteDB.display.buttonWait(`#btnUnenroll${idx}`, true);

                var carePlan = await SanteDB.resources.patient.invokeOperationAsync($scope.scopedObject.id, "carepath-unenroll", {
                    pathway: pathway.id
                });
                $(`#carePathway${idx}`).collapse("hide");
                $timeout(() =>{
                    pathway._enrolled = false;
                    pathway.encounters = null;
                });
                toastr.success(SanteDB.locale.getString("ui.emr.patient.carePaths.unenroll.success"));
            }
            catch (e) {
                $rootScope.errorHandler(e);
            }
            finally {
                SanteDB.display.buttonWait(`#btnUnenroll${idx}`, false);
            }
        }
    }
    async function enroll(pathway, idx) {

        if (confirm(SanteDB.locale.getString("ui.emr.patient.carePaths.enroll.confirm", { pathway: pathway.name }))) {
            try {
                SanteDB.display.buttonWait(`#btnEnroll${idx}`, true);
                var carePlan = await SanteDB.resources.patient.invokeOperationAsync($scope.scopedObject.id, "carepath-enroll", {
                    pathway: pathway.id
                });

                await fetchNextEncounters(pathway, 1, 3);
                $(`#carePathway${idx}`).collapse("show");
                $timeout(() => pathway._enrolled = true);
                toastr.success(SanteDB.locale.getString("ui.emr.patient.carePaths.enroll.success"));
            }
            catch (e) {
                $rootScope.errorHandler(e);
            }
            finally {
                SanteDB.display.buttonWait(`#btnEnroll${idx}`, false);
            }
        }
    }
    async function recompute(pathway, idx) {
        
        if(confirm(SanteDB.locale.getString("ui.emr.patient.carePaths.recompute.confirm", { pathway: pathway.name }))) {
            try {
                SanteDB.display.buttonWait(`#btnRecompute${idx}`, true);
                var carePlan = await SanteDB.resources.patient.invokeOperationAsync($scope.scopedObject.id, "carepath-recompute", {
                    pathway: pathway.id
                });
                await fetchNextEncounters(pathway.id, 1, 3, true);
                $(`#carePathway${idx}`).collapse("show");
                toastr.success(SanteDB.locale.getString("ui.emr.patient.carePaths.recompute.success"));
            }
            catch(e) {
                $rootScope.errorHandler(e);
            }
            finally {
                SanteDB.display.buttonWait(`#btnRecompute${idx}`, false);
            }
        }
    }

    async function startVisit(pathway, encounter, idx) {
        try {
            SanteDB.display.buttonWait(`#btnStartVisit${idx}`, true);
            var templateId = encounter.templateModel.mnemonic;
            var fulfills = [new ActRelationship({
                target: encounter.id
            })];
            var fulfillmentTargets = encounter.relationship.HasComponent.map(o => new ActRelationship({
                target: o.target,
                targetModel: {
                    $type: o.targetModel.$type,
                    protocol: o.targetModel.protocol
                }
            }));

            var encounter = await SanteEMR.startVisitAsync(templateId, pathway, $scope.scopedObject.id, fulfills, fulfillmentTargets);
            $scope.scopedObject

            toastr.success(SanteDB.locale.getString("ui.emr.encounter.checkin.success"));
            $state.go("santedb-emr.encounter.view", { id: encounter.id });

        }
        catch(e) {
            $rootScope.errorHandler(e);
        }
        finally {
            SanteDB.display.buttonWait(`#btnStartVisit${idx}`, false);
        }
    }
    $scope.resolveTemplateIcon = SanteEMR.resolveTemplateIcon;
    $scope.resolveSummaryTemplate = SanteEMR.resolveSummaryTemplate;
    $scope.enroll = enroll;
    $scope.unenroll = unenroll;
    $scope.recompute = recompute;
    $scope.startVisit = startVisit; 
    $scope.fetchNextEncounters = fetchNextEncounters;
    initializeView($scope.scopedObject.id);
}]);
