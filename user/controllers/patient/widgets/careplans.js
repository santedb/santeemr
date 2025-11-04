/// <reference path="../../../.ref/js/santedb.js"/>
/*
 * Copyright (C) 2021 - 2025, SanteSuite Inc. and the SanteSuite Contributors (See NOTICE.md for full copyright notices)
 * Portions Copyright (C) 2019 - 2021, Fyfe Software Inc. and the SanteSuite Contributors
 * Portions Copyright (C) 2015-2018 Mohawk College of Applied Arts and Technology
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you
 * may not use this file except in compliance with the License. You may
 * obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
 * License for the specific language governing permissions and limitations under
 * the License.
 *
 */
angular.module('santedb').controller('EmrPatientCarePlanController', ['$scope', '$timeout', '$rootScope', "$state", function ($scope, $timeout, $rootScope, $state) {

    async function initializeView(patientId) {
        try {
            var carePathways = await SanteDB.resources.patient.invokeOperationAsync(patientId, "carepath-eligibilty");
            var enrolledCarePathways = await SanteDB.resources.patient.findAssociatedAsync(patientId, "carepaths");

            carePathways.forEach(cp => {
                if (enrolledCarePathways.resource && enrolledCarePathways.resource.find(o => o.id == cp.id || o.pathway == cp.id)) {
                    cp._enrolled = true;
                }
            });

            // Are there any care pathways the patient is enrolled in that they are ineligible to be enrolled in?
            var nonEligibleCarePathways = enrolledCarePathways.resource?.filter(cp => !carePathways.find(el => el.id == cp.id));
            if(nonEligibleCarePathways?.length > 0 && confirm(SanteDB.locale.getString("ui.emr.patient.carepath.unenrolAuto", { pathway: nonEligibleCarePathways.map(o=>o.name).join(",") }))) {
                nonEligibleCarePathways.forEach(cp => SanteDB.resources.patient.invokeOperationAsync($scope.scopedObject.id, "carepath-unenroll", {
                    pathway: cp.id
                }));
            }
            else {
                nonEligibleCarePathways?.forEach(cp => {
                    cp._enrolled = true;
                    cp._ineligible = true;
                    carePathways.push(cp);
                })
            }

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
                    'actTime': `>${moment().add(-monthLimit || 2, 'month').format("YYYY-MM-DD")}`,
                    _orderBy: 'actTime:asc',
                    _count: 4,
                    _includeTotal: false
                };

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

                            // Block starting all encounters - i.e. one encounter is already started - so we want to not allow starting encounters
                            proposed.forEach(p=>{
                                p.tag = p.tag || {};
                                p.tag["$nostart"] = [true];
                            });
                        }
                    }
                }
                
                var now = new Date().trunc();
                proposed.filter(enc=>!(enc.tag && enc.tag.$nostart)).forEach(enc => {
                    if (
                        (enc.startTime || enc.actTime).trunc() <= now && (enc.stopTime || enc.actTime).trunc() >= now || // start and stop time are in bound
                        enc.actTime.isoWeek() == now.isoWeek() && enc.actTime.getFullYear() == now.getFullYear() // Encounter was scheduled to start this week
                    )
                    {
                        enc.tag = enc.tag || {};
                        enc.tag["$canstart"] = [true];
                    }
                });

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
                toastr.success(SanteDB.locale.getString("ui.emr.patient.carePaths.enroll.success"));
                $state.reload();
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
                toastr.success(SanteDB.locale.getString("ui.emr.patient.carePaths.recompute.success"));
                $state.reload();
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
            // var templateId = encounter.templateModel.mnemonic;
            // var fulfills = [new ActRelationship({
            //     target: encounter.id
            // })];

            // var fulfillmentTargets = encounter.relationship.HasComponent.map(o => new ActRelationship({
            //     target: o.target,
            //     targetModel: {
            //         $type: o.targetModel.$type,
            //         protocol: o.targetModel.protocol
            //     }
            // }));

            // var encounter = await SanteEMR.startVisitAsync(templateId, pathway, $scope.scopedObject.id, fulfills, fulfillmentTargets);
            // $scope.scopedObject

            // toastr.success(SanteDB.locale.getString("ui.emr.encounter.checkin.success"));
            // $state.go("santedb-emr.encounter.view", { id: encounter.id });
            SanteEMR.showCheckin($scope.scopedObject.id, encounter.id);
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
