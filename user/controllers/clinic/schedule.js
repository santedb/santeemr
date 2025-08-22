/// <reference path="../../.ref/js/santedb.js" />
/// <reference path="../../.ref/js/santedb-model.js" />

angular.module('santedb').controller('EmrClinicScheduleController', ["$scope", "$rootScope", "$state", "$timeout", function ($scope, $rootScope, $state, $timeout) {


    const eventTheme = {
        [ActMoodKeys.Appointment] : {
            background: 'indigo',
            border: 'white',
            text: 'white'
        },
        [ActMoodKeys.Propose] : {
            background: 'azure',
            border: 'navy',
            text: 'navy'
        },
        [ActMoodKeys.Eventoccurrence] : {
            background: 'darkgreen',
            border: 'lightgreen',
            text: 'white'
        },
        [ActMoodKeys.Intent] : {
            background: 'lightgreen',
            border: 'darkgreen',
            text: 'black'
        }
    }

    const statusTheme = {
        [StatusKeys.New] : 'fas fa-fw fa-asterisk text-primary',
        [StatusKeys.Completed] : 'fas fa-fw fa-circle-check text-success',
        [StatusKeys.Active] : 'fas fa-fw fa-play text-primary',
        [StatusKeys.Cancelled] : 'fas fa-fw fa-times-circle text-danger',
        [StatusKeys.Nullified] : 'fas fa-fw fa-trash text-dark'
    }

    const eventTypeIcons = {
        [SubstanceAdministration.name] : "fas fa-fw fa-syringe",
        [QuantityObservation.name] : "fas fa-fw fa-weight-scale",
        [CodedObservation.name] : "fas fa-fw fa-list-check",
        [TextObservation.name] : "fas fa-fw fa-pen",
        [Document.name] : "fas fa-fw fa-file",
        [Act.name] : "far fa-fw fa-circle",
        [Procedure.name] : "far fa-fw fa-bed-pulse"
    }

    var _calendar = null;

    function handleEventOpen(evt) {
        console.info(evt);
    }

    function renderEventContent(evt) {
        switch(evt.view.type) {
            case 'dayGridMonth':
                return { html: `<i class='${statusTheme[evt.event.extendedProps.act.statusConcept]}'></i> ${getEventSummaryTitle(evt.event.extendedProps.act)}` };
            case 'dayGridWeek':
                return { html: `<h5><i class='${statusTheme[evt.event.extendedProps.act.statusConcept]}'></i> ${getEventSummaryTitle(evt.event.extendedProps.act)}</h5><small>${getEventWeekDetail(evt.event.extendedProps.act)}</small>`}
            case 'dayGridDay':
            case 'list' :
                return { html: `<h5><i class='${statusTheme[evt.event.extendedProps.act.statusConcept]}'></i> ${getEventSummaryTitle(evt.event.extendedProps.act)}</h5><small>${getEventWeekDetail(evt.event.extendedProps.act)}</small>${getEventDayDetail(evt.event.extendedProps.act)}`}
                
        }

    }

    function getEventSummaryTitle(evt) {
        switch (evt.classConcept) {
            case ActClassKeys.Encounter:
                return `${SanteDB.display.renderEntityName(evt.participation?.RecordTarget[0]?.playerModel?.name)} / ${SanteDB.display.renderAge(evt.participation?.RecordTarget[0]?.playerModel.dateOfBirth)} / ${SanteDB.display.renderConcept(evt.participation?.RecordTarget[0]?.playerModel.genderConceptModel)[0]}`;
            case ActClassKeys.List:
                return SanteDB.display.renderConcept(evt.typeConceptModel);;
            default:
                return "Other";
        }
    }

    function getEventWeekDetail(evt) {
        return `<strong>${SanteDB.display.renderConcept(evt.moodConceptModel)}</strong> - ${SanteDB.display.renderConcept(evt.typeConceptModel)} - ${SanteDB.display.renderConcept(evt.statusConceptModel)}`;
    }

    function getEventDayDetail(evt) {
        var retVal= "<ul>"
        Object.keys(evt.relationship.HasComponent?.map(typ => {
            retVal += `<li><i class='${eventTypeIcons[typ.targetModel.$type]}'></i> ${SanteDB.display.renderConcept(typ.targetModel.typeConceptModel)}</li>`
        }).groupBy(
            k=>k,
            k=>k
        )).forEach(k => retVal += k);

        retVal += "</ul>";
        return retVal;
    }
    
    function getEventIcon(evt) {
        switch (evt.classConcept) {
            case ActClassKeys.Encounter:
                return "fas fa-fw fa-user";
            case ActClassKeys.List:
                return "fas fa-fw fa-users-viewfinder";
            default:
                return "fas fa-fw fa-question-circle";
        }
    }

    // Fetch events
    async function fetchEvents(filter, success, reject) {
        try {
            var a = new Act();
            a.start

            _calendar?.removeAllEvents();
            success([]);
            var calendarEvents = [];
            var eventBundle = new Bundle({ totalResults: 1 });
            var offset = 0;
            while (offset < eventBundle.totalResults) {
                eventBundle = await SanteDB.resources.act.findAsync({ // Sessions, intent acts, etc.
                    "classConcept": [ActClassKeys.List, ActClassKeys.Encounter],
                    "actTime": [`>${filter.startStr}`, `<${filter.endStr}`],
                    "moodConcept": [ActMoodKeys.Intent, ActMoodKeys.Propose, ActMoodKeys.Eventoccurrence, ActMoodKeys.Appointment],
                    "statusConcept": [StatusKeys.New, StatusKeys.Active, StatusKeys.Completed],
                    _offset: offset,
                    _count: 25
                }, "emr.facilityPlan");

                offset += eventBundle.resource?.length || 0;
                
                eventBundle.resource?.filter(e => e.$type != "PatientEncounter" || e.participation?.RecordTarget).map(evt => ({
                    start: evt.moodConcept == ActMoodKeys.Eventoccurrence ? moment(evt.startTime || evt.actTime).format("YYYY-MM-DDTHH:mm:ss") : moment(evt.actTime).format("YYYY-MM-DDTHH:mm"),
                    end: evt.moodConcept == ActMoodKeys.Eventoccurrence ? moment(evt.stopTime).format("YYYY-MM-DDTHH:mm:ss") : moment(evt.actTime).format("YYYY-MM-DDTHH:mm"),
                    title: getEventSummaryTitle(evt),
                    backgroundColor: eventTheme[evt.moodConcept]?.background,
                    borderColor: eventTheme[evt.moodConcept]?.border,
                    textColor: eventTheme[evt.moodConcept]?.text,
                    display: 'block',
                    classNames: 'emr-event',
                    allDay: evt.moodConcept != ActMoodKeys.Eventoccurrence,
                    extendedProps: {
                        act: evt
                    }
                })).forEach(evt => _calendar.addEvent(evt));
            }

        }
        catch (e) {
            $rootScope.errorHandler(e);
        }
    }

    // Initialize view
    async function initializeView() {
        try {
            const calendarData = {};
            calendarData.facility = await SanteDB.resources.place.getAsync(SanteDB.configuration.getAssignedFacilityId(), "min");
            $timeout(() => $scope.calendarData = calendarData);
            _calendar = new FullCalendar.Calendar(document.getElementById('facilityCalendar'), {
                initialDate: moment().format("YYYY-MM-DD"),
                selectable: true,
                businessHours: true,
                dayMaxEvents: true,
                eventContent: renderEventContent,
                headerToolbar: {
                    start: 'title',
                    center: null,
                    right: 'dayGridMonth,dayGridWeek,dayGridDay,list today prev,next'
                },
                themeSystem: 'bootstrap',
                initialView: 'dayGridWeek',
                events: fetchEvents,
                eventClick: handleEventOpen,
                dateClick: function (info) {
                    _calendar.changeView('dayGridDay', info.dateStr);
                },
                select: function (info) {
                    _calendar.changeView('dayGridWeek', info.startStr);
                }
            });
            _calendar.render();
        }
        catch (e) {
            $rootScope.errorHandler(e);
        }
    }

    initializeView();

}]);