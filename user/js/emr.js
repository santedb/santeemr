/// <reference path="../.ref/js/santedb.js" />

// Convert an age to a date
function ageToDate(age, onDate) {

    return moment(onDate).subtract({ years: age }).startOf('day').toDate();
}

/// Convert a date to an age
function dateToAge(date, onDate) {
    return moment(onDate).diff(date, 'years', false);

}

const ENCOUNTER_FLOW = {
    EXTENSION_URL: 'http://santedb.org/emr/extensions/encounter-flow',
    CHECKED_IN: 'A63E9BCC-BE32-4EA6-A43F-1F3C771114D4',
    WAIT_OBSERVATION: 'AEDF62BB-48F5-437E-914D-36E0CD57B8F8',
    WAIT_SPECIALIST: 'F5201716-8AA2-4BB9-B574-763E87E3372D'
};

const ADT_REGISTRATION_TYPES = {
    BIRTH: 'f562e322-17ca-11eb-adc1-0242ac120002',
    DEATH: 'f562e458-17ca-11eb-adc1-0242ac120002',
    ADMIT: 'f562e624-17ca-11eb-adc1-0242ac120002'
}

const TEMPLATE_IDS = {
    SupplementAdministration: 'feac9b2d-e560-4b75-ac77-921bf0eceee8',
    BirthRegistration: 'c521e96f-3e5e-4347-8279-5228b4b68be6',
    DeathRegistration: '627b5b71-ba67-484b-811c-9ef00ec4d5f0',
    NewbornInformation: 'b0ca8509-6c0d-403a-b381-5485fdce5794',
    CauseOfDeath: '3fc9cce1-b9bb-4a9d-b054-2d19fa34da72',
    Patient: '81bc8c96-2f02-4c3f-9e2a-50fba42984a7',
    BirthLocation: 'b7548aa1-97a6-4c3a-b735-2d1dbf2898f8',
    BirthDeliveryMethod: '5d31af1e-8bd5-4e22-a1cb-299a7a91ccbb',
    BirthDeliveryOutcome: '6f48110f-c5e7-47a1-ae02-00ef94c1edcc',
    BirthWeight: '20691188-f1ca-4d06-90a4-8f857c293853',
    BodyHeight: 'e052a85e-b7fb-4808-aa5c-14147abd5fe8',
    PregnancyHistory: 'ea4e5cfb-fb49-434f-8b5e-c8f027f18775',
    ClinicalDeath: '740bd62b-54bf-4bba-8546-954cdb5bb63a',
    VerificationStatus: '637be9d0-1d17-46b6-abce-35f90fb0eb9a',
    ImmunizationAdministration: '50ac9b2d-e560-4b75-ac77-921bf0eceee8'
}

/**
 * @class
 * @static
 * @constructor
 * @summary SanteEMR Binding Class
 * @description This is a wrapper class that encapsulates the functionality of SanteEMR
 */
function SanteEMRWrapper() {

    const _IGNORE_RELATIONSHIPS = [
        BatchOperationType.Delete,
        BatchOperationType.DeleteInt,
        BatchOperationType.Ignore,
        BatchOperationType.IgnoreInt
    ]

    /**
     * 
     * @param {Bundle} submissionBundle The bundle to set the performers on
     * @param {Guid} thisUserId The UUID of the current user to attribute
     * @param {String} thisUsersParticipationType The participation this user has
     * @returns 
     */
    function _setVisitPerformers(submissionBundle, thisUserId, thisUsersParticipationType) {

        // For each entry which is being updated set the performer
        submissionBundle.resource.filter(act => _IGNORE_RELATIONSHIPS.indexOf(act.operation) == -1).forEach(act => {
            act.participation = act.participation || {};

            var participationType = "Performer";
            act.participation = act.participation || {};

            if (act.$type != PatientEncounter.name) {
                act.actTime = act.stopTime = act.stopTime || new Date();
                
                // We already have a performer
                if(act.participation.Performer) {
                    participationType = "SecondaryPerformer";
                }
                if (act.tag && act.tag.isBackEntry && act.tag.isBackEntry[0] != "True") {
                    participationType = "DataEnterer";
                }
            }
            else {
                participationType = thisUsersParticipationType || "Performer";
            }

            act.participation[participationType] = act.participation[participationType] || [];
            if (act.participation[participationType].find(o => o.player == thisUserId) == null) {
                act.participation[participationType].push(new ActParticipation({
                    player: thisUserId
                }));
            }

        });
        return submissionBundle;
    }

    /**
     * @method
     * @private
     * @summary Prepares the {@link:encounter} for submission by processing reference extensions and extracting the components
     * @param {PatientEncounter} encounter The encounter to prepare
     * @return {Bundle} The bundled encounter submission
     */
    async function _bundleVisit(encounter) {
        encounter = new PatientEncounter(angular.copy(encounter));
        // Process extensions
        if (encounter.extension) {
            Object.keys(encounter.extension).forEach(url => {
                encounter.extension[url] = encounter.extension[url].map(ext => {
                    if (ext.$type) // reference
                    {
                        return SanteDB.application.encodeReferenceExtension(ext.$type, ext.id);
                    }
                    return ext;
                });
            });
        }

        encounter.operation = BatchOperationType.UpdateInt;

        encounter = await prepareActForSubmission(encounter);
        /** @type {Bundle} */
        var bundle = bundleRelatedObjects(encounter, ["Informant", "RecordTarget", "Location", "Performer", "Authororiginator", "_HasComponent", "Fulfills"]);
        encounter = bundle.resource.find(o => o.$type == PatientEncounter.name);
        // remove components which have a deleted target
        if (encounter.relationship && encounter.relationship.HasComponent) {
            encounter.relationship.HasComponent = encounter.relationship.HasComponent.filter(e => {
                return bundle.resource.find(o => o.id == e.target && o.operation != BatchOperationType.Delete && o.operation != BatchOperationType.DeleteInt) != null;
            });
        }

        bundle.correlationId = encounter.id;
        return bundle;
    }

    /**
     * @method
     * @summary Perform an analysis of the actions in the {@link:encounter} and return the detected issues
     * @param {PatientEncounter} encounter The encounter containing data to be analysed
     * @returns {Array} The array of detected issues
     */
    this.analyzeVisit = async function (encounter) {
        try {
            var bundle = await _bundleVisit(encounter);
            bundle.resource = bundle.resource.filter(act => _IGNORE_RELATIONSHIPS.indexOf(act.operation) == -1);
            bundle.resource.forEach(act => { act.interpretationConcept = null });
            var result = await SanteDB.resources.bundle.invokeOperationAsync(null, "analyze", {
                target: bundle
            });
            return result;
        }
        catch (e) {
            throw new Exception("EmrException", "Could not analyze the submitted visit", null, e);
        }
    }

    /**
     * @method
     * @memberof SanteEMRWrapper
     * @param {string} patientId The patient identifier to show the checkin modal for
     * @param {string} encounterId The encounter identifier to be selected as the start encounter
     */
    this.showCheckin = function (patientId, encounterId) {
        var checkinModal = angular.element("#checkinModal");
        if (checkinModal == null) {
            console.warn("Have not included the checkin-modal.html file");
            return;
        }

        checkinModal.scope().encounterId = encounterId;
        checkinModal.scope().patientId = patientId;
        $("#checkinModal").modal('show');
    }

    /**
     * @method
     * @memberof SanteEMRWrapper
     * @param {string} encounter The encounter or encounter id to be discharged
     * @param {timeout} $timeout The scope timeout service
     * @param {Function} afterAction After the modal closes, the action to execute
     */
    this.showDischarge = async function (encounter, $timeout, afterAction) {
        var dischargeModal = angular.element("#dischargeModal");

        if (dischargeModal == null) {
            console.warn("Have not included the discharge-modal.html file");
            return;
        }

        try {
            var analyzeResult = await SanteEMR.analyzeVisit(encounter);
            var scope = dischargeModal.scope();
            var enc = angular.copy(encounter);
            enc._tmpId = SanteDB.application.newGuid();            
            
            if(afterAction) {
                $("#dischargeModal").on("hidden.bs.modal", function(e) {
                    const isAfterActionDeferred = !!$(this).data('deferAction');       
                    $(this).removeData('deferAction');             

                    if(!isAfterActionDeferred && scope.encounter._persisted) {
                        afterAction();
                    }

                    $("#dischargeModal").off("hidden.bs.modal");
                });
            }

            $timeout(() => {
                scope.encounter = enc;
                scope.issues = analyzeResult.issue;
                $("#dischargeModal").modal('show');
                $("#dischargeModal").data('after-action', afterAction);
            });

        }
        catch (e) {
            throw new Exception("EmrException", "Error showing discharge details", null, e);
        }
    }

    /** 
     * @method
     * @memberof SanteEMRWrapper
     * @param {string} encounter The encounter object to show the modal for
     */
    this.showRequeue = function (encounter) {
        var requeueModal = angular.element("#returnModal");
        if (requeueModal == null) {
            console.warn("Have not included the return-waiting-modal.html file");
            return;
        }

        requeueModal.scope().encounter = encounter;
        $("#returnModal").modal('show');
    }

    /** 
     * @method
     * @memberof SanteEMRWrapper
     * @param {string} encounter The encounter object to show details for
     */
    this.showAppointmentBooking = function (encounter, $timeout, afterAction) {
        var appointmentBookingModal = angular.element("#appointmentBookingModal");
        var scope = appointmentBookingModal.scope();

        if (appointmentBookingModal == null) {
            console.warn("Have not included the return-waiting-modal.html file");
            return;
        }
        
        if(afterAction) {
            $("#appointmentBookingModal").on("hidden.bs.modal", function(e) {
                afterAction();
               
                $("#appointmentBookingModal").off("hidden.bs.modal");
            });
        }

        $timeout(() => {
            scope.encounter = encounter;
            $("#appointmentBookingModal").modal('show');
            $("#appointmentBookingModal").data('after-action', afterAction);
        });
    }

    /**
     * @summary Determines whether the patient has an open encounter or not
     * @param {Patient} patient The patient which is supposed to have the open encounter
     * @returns The updated patient with a populated tag if the encounter is open
     */
    this.patientHasOpenEncounter = async function (patient) {
        if (patient.id) {
            try {
                var encounters = await SanteDB.resources.patientEncounter.findAsync({ moodConcept: ActMoodKeys.Eventoccurrence, statusConcept: StatusKeys.Active, "participation[RecordTarget].player": patient.id, _count: 0, _includeTotal: true });
                if (encounters.totalResults > 0) {
                    patient.tag = patient.tag || {};
                    patient.tag.$hasEncounter = true;
                }
            }
            catch (e) { }
        }
        return patient;
    }


    /**
     * @summary Resolves the template icon for the specified act/entity template
     * @param {string} templateId The template mnemonic to resolve the icon for
     * @returns The resolved icon 
     */
    this.resolveTemplateIcon = function (templateId) {        
        var template = SanteDB.application.getTemplateMetadata(templateId);
        if (template) {
            return template.icon;
        }
        else {
            return "fa-notes-medical";
        }
    }

    /**
     * @summary Resolve the summary template (one line summary) for the template
     * @param {string} templateId The template mnemonic to resolve the summary for
     * @returns {String} The location of the summary template
     */
    this.resolveSummaryTemplate = function (templateId) {
        var templateValue = SanteDB.application.resolveTemplateSummary(templateId);
        if (templateValue == null) {
            return "/org.santedb.uicore/partials/act/noTemplate.html"
        }
        return templateValue;
    }

    /**
     * @summary Save the encounter 
     * @method
     * @param {PatientEncounter} encounter The encounter that is to be saved
     * @param {String} thisUsersParticipationType The participation that this user has in the encounter
     * @returns {PatientEncounter} The updated encounter
     */
    this.saveVisitAsync = async function (encounter, thisUsersParticipationType) {
        try {

            var submissionBundle = await _bundleVisit(encounter);
            // Is the current user listed as a performer?
            var myUserId = await SanteDB.authentication.getCurrentUserEntityId();
            submissionBundle = _setVisitPerformers(submissionBundle, myUserId, thisUsersParticipationType);
            submissionBundle = await SanteDB.resources.bundle.insertAsync(submissionBundle);
            encounter._persisted = true;
            return submissionBundle.resource.find(o => o.$type == "PatientEncounter");
        }
        catch (e) {
            throw new Exception("EmrException", e.message, null, e);
        }
    }

    /**
     * @summary Starts a visit given the input parameters provided
     * @param {string} templateId The visit template (encounter template) which is to be started, this dictates the input form and the structure of the visit
     * @param {string} carePathway The care pathway in which this visit fits (used for generating the CDSS actions)
     * @param {string} recordTargetId The identification of the record target to which the visit is intended 
     * @param {ActRelationship} fulfills An array of {@link:ActRelationship} objects which represent the encounter in the care plan that this visit fulfills
     * @param {ActRelationship} fulfillmentComponents An array of {@link:ActRelationship} objects which reprensets the proposals from the stored care plan which this visit is fulfilling
     * @param {ActParticipation} informantPtcpt The informant / guardian on the act
     * @returns {PatientEncounter} The constructed and saved {@link:PatientEncounter}
     */
    this.startVisitAsync = async function (templateId, carePathway, recordTargetId, fulfills, fulfillmentComponents, informantPtcpt) {
        try {

            var submission = new Bundle({ resource: [] });

            // Template
            var template = await SanteDB.application.getTemplateContentAsync(templateId, {
                recordTargetId: recordTargetId,
                facilityId: await SanteDB.authentication.getCurrentFacilityId(),
                userEntityId: await SanteDB.authentication.getCurrentUserEntityId()
            });

            var encounter = new PatientEncounter(template);
            submission.correlationId = encounter.id = encounter.id || SanteDB.application.newGuid();
            encounter.relationship = encounter.relationship || {};
            encounter.relationship.HasComponent = encounter.relationship.HasComponent || [];
            encounter.relationship.Fulfills = fulfills;
            // Ensure the appropriate keys are set
            encounter.startTime = encounter.actTime = new Date();
            encounter.statusConcept = StatusKeys.Active;
            encounter.extension = encounter.extension || {};
            encounter.extension[ENCOUNTER_FLOW.EXTENSION_URL] = [SanteDB.application.encodeReferenceExtension(Concept.name, ENCOUNTER_FLOW.CHECKED_IN)];

            // Set the status 

            // Compute the actions to be performed
            var actions = await SanteDB.resources.patient.invokeOperationAsync(recordTargetId, "generate-careplan", {
                pathway: carePathway,
                //firstOnly: true,
                encounter: template.templateModel.mnemonic,
                period: moment().format("YYYY-MM-DD"),
                _includeBackentry: true
            }, undefined, "min");

            actions.relationship.HasComponent.forEach(comp => {
                var ar = new ActRelationship({
                    relationshipType: comp.relationshipType,
                    target: comp.target || comp.targetModel.id || SanteDB.application.newGuid(),
                    targetModel: comp.targetModel,
                    source: encounter.id
                });
                encounter.relationship.HasComponent.push(ar);

                if (!comp.targetModel.tag || !comp.targetModel.tag.isBackEntry) {
                    comp.targetModel.stopTime = null;
                    comp.targetModel.actTime = comp.targetModel.startTime = encounter.startTime;
                }

                comp.targetModel.id = comp.targetModel.id || ar.target;
                comp.targetModel.moodConcept = encounter.moodConcept;
                delete comp.targetModel.moodConceptModel;
                comp.targetModel.statusConcept = encounter.statusConcept;
                delete comp.targetModel.statusConceptModel;

                // Fulfillment for the target model
                if (comp.targetModel && comp.targetModel.protocol) {
                    var fulfillment = fulfillmentComponents.find(o => {
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
            });

            if (informantPtcpt) {
                encounter.participation = encounter.participation || {};
                encounter.participation.Informant = encounter.participation.Informant || [];
                encounter.participation.Informant.push(informantPtcpt);
                if (informantPtcpt.playerModel && informantPtcpt.player != informantPtcpt.playerModel.id) {
                    delete informantPtcpt.playerModel;
                }
            }

            encounter = await prepareActForSubmission(encounter);
            submission = bundleRelatedObjects(encounter, ["Informant", "RecordTarget", "Location", "Authororiginator"]);

            if (informantPtcpt && informantPtcpt.playerModel && informantPtcpt.player == informantPtcpt.playerModel.id) {
                informantPtcpt.playerModel = await prepareEntityForSubmission(informantPtcpt.playerModel, true);
                submission.resource.push(informantPtcpt.playerModel);
                submission.resource.push(new EntityRelationship(
                    informantPtcpt.playerModel.relationship.$other[0]
                ));
                delete informantPtcpt.playerModel.relationship.$other;
                delete informantPtcpt.playerModel;

            }

            // Now we want to submit
            var submittedBundle = await SanteDB.resources.bundle.insertAsync(submission);
            return submittedBundle.resource.find(o => o.$type == "PatientEncounter");
        }
        catch (e) {
            throw new Exception("EmrException", e.message, null, e);
        }
    }

    /**
     * @summary Attempt to get the care plan from the encounter id
     * @param {string} proposedEncounterId The proposed encounter identifier from which the care plan should be fetched
     * @returns {CarePlan} The care plan that the proposed encounter id belongs
     */
    this.getCarePlanFromEncounter = async function (proposedEncounterId) {
        try {
            var cps = await SanteDB.resources.carePlan.findAsync({
                "relationship[HasComponent].target": proposedEncounterId,
                "statusConcept": StatusKeys.Active,
                _includeTotal: false,
                _count: 1
            }, "fastview");
            
            if (cps.resource) {
                return cps.resource[0];
            }
            else {
                return null;
            }
        }
        catch (e) {
            throw new Exception("EmrException", "Failed to fetch careplan", null, e);
        }
    }

}

/**
 * @type {SanteEMRWrapper}
 * @global
 */
var SanteEMR = new SanteEMRWrapper();

// Helper functions
Patient.prototype.age = function (measure) {
    return moment().diff(this.dateOfBirth, measure || 'years', false);
}

Patient.prototype.hasCondition = function (conditionTypeConcept) {

}



$(window).bind("touchstart", function(downEvent) {
    var downTouch = downEvent.originalEvent.touches[0];
    var direction = { x: 0, y: 0 };

    $(window).bind("touchmove", function(moveEvent) {
        var moveTouch = moveEvent.originalEvent.touches[0];
        direction.x = moveTouch.pageX > downTouch.pageX ? 1 : -1;
        direction.y = moveTouch.pageY > downTouch.pageY ? 1 : -1;
    });

    $(window).bind("touchend", function(endEvent) {
        $(window).unbind("touchmove");
        $(window).unbind("touchend");

        $(downEvent.target).trigger("swipe", { 
            swipeLeft: direction.x < 0, 
            swipeRight: direction.x > 0,
            swipeDown: direction.y > 0, 
            swipeUp: direction.y < 0
        });
    
    });

})

// Determine if this device is a touch device
window.isTouchDevice = function() {
    return (('ontouchstart' in window) ||
     (navigator.maxTouchPoints > 0) ||
     (navigator.msMaxTouchPoints > 0));
}
