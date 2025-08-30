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
    var _calendarFilter = null;

    function handleEventOpen(evt) {
        
        // Determine where to route the data 
        if(evt.event.extendedProps.act.moodConcept === ActMoodKeys.Eventoccurrence) {
            SanteDB.application.callResourceViewer(evt.event.extendedProps.act.$type, null, { id: evt.event.extendedProps.act.id });
        } else if(evt.event.extendedProps.act.participation?.RecordTarget[0].player) {
            SanteDB.application.callResourceViewer("Patient", null, { id : evt.event.extendedProps.act.participation?.RecordTarget[0].player });
        }
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
        evt.relationship.HasComponent?.filter(o=>o.targetModel).map(typ => `<li><i class='${eventTypeIcons[typ.targetModel.$type]}'></i> ${SanteDB.display.renderConcept(typ.targetModel.typeConceptModel)}</li>`
        ).distinct().forEach(k => retVal += k);

        retVal += "</ul>";
        return retVal;
    }
    
    $scope.filterCalendar = function () {
        if($scope.filterText && $scope.filterText !== "") {
            _calendarFilter = {
                'participation[RecordTarget].player.name.component.value||participation[RecordTarget].player.identifier.value||participation[RecordTarget].player.relationship[Mother|Father].target.name.component.value' : `~${$scope.filterText}`
            };
        }
        else {
            _calendarFilter = null;
        }

        _calendar.refetchEvents();
    }

    // Fetch events
    async function fetchEvents(filter, success, reject) {
        try {
            var a = new Act();
            a.start

            $("#loadProgressBar").removeClass("d-none");

            _calendar?.removeAllEvents();
            success([]);
            var calendarEvents = [];
            var eventBundle = new Bundle({ totalResults: 1 });
            var offset = 0;
            while (offset < eventBundle.totalResults) {
                $("#loadProgressBar .progress-bar").css("width", `${(offset / eventBundle.totalResults)* 100}%`);
                eventBundle = await SanteDB.resources.act.findAsync({ // Sessions, intent acts, etc.
                    ..._calendarFilter,
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
        finally {
            $("#loadProgressBar").addClass("d-none");
        }
        
    }

    // Initialize view
    async function initializeView() {
        try {
            const calendarData = {};
            calendarData.facility = await SanteDB.resources.place.getAsync(await SanteDB.authentication.getCurrentFacilityId(), "min");
            $timeout(() => $scope.calendarData = calendarData);
            _calendar = new FullCalendar.Calendar(document.getElementById('facilityCalendar'), {
                initialDate: moment().format("YYYY-MM-DD"),
                selectable: true,
                businessHours: true,
                views: {
                    dayGridMonth: {
                        dayMaxEvents: true
                    },
                    dayGridWeek: {
                        dayMaxEvents: true
                    },
                    dayGridDay: {
                        dayMaxEvents: false
                    }
                },
                moreLinkClick: (e) => {
                    switch(_calendar.view.type) {
                        case 'dayGridMonth':
                            return 'week';
                        case 'dayGridWeek':
                            return "day";
                        default: 
                            return "list";
                    }
                },
                eventContent: renderEventContent,
                headerToolbar: {
                    start: 'dayGridMonth,dayGridWeek,dayGridDay,list',
                    center: 'title',
                    right: null
                },
                footerToolbar: {
                    right: 'today,prev,next'
                },
                themeSystem: 'bootstrap',
                bootstrapFontAwesome: {
                    close: 'fas fa-fw fa-times',
                    prev: 'fas fa-fw fa-chevron-left my-1',
                    next: 'fas fa-fw fa-chevron-right my-1',
                    prevYear: 'fas fa-fw fa-angle-double-left',
                    nextYear: 'fas fa-fw fa-angle-double-right'
                },
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

           
            injectHeaderFn = () => {
                var targetSearchDiv = $(".fc-header-toolbar .fc-toolbar-chunk")[2];
                var searchDiv = $("#calendarSearchBar");
                var progressDiv = $("#loadProgressBar");
                var targetProgressDiv = $(".fc-footer-toolbar .fc-toolbar-chunk")[0];

                if(targetSearchDiv && targetProgressDiv) {
                    searchDiv.removeClass("d-none");
                    searchDiv.appendTo(targetSearchDiv);
                    $('.fc-prev-button').addClass("h-auto");
                    $('.fc-next-button').addClass("h-auto");
                    progressDiv.appendTo(targetProgressDiv);
                }
                else {
                    $timeout(injectHeaderFn, 250);
                }
            };
            injectHeaderFn();
        }
        catch (e) {
            $rootScope.errorHandler(e);
        }
    }

    initializeView();

}]);