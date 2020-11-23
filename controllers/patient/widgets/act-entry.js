/// <reference path="../../../.ref/js/santedb.js"/>
angular.module('santedb').controller('EmrActEntryWidgetController', ['$scope', '$rootScope', '$stateParams', '$state', function ($scope, $rootScope, $stateParams, $state) {

    var _templates = [];

    // The act which is being constructed 
    $scope.act = {};

    $scope.$watch("act.$templateContext", function (n, o) {
        if (n == "org.santedb.model.act" && $stateParams.templateId) {
            $scope.act.$noTemplate = true;
            setTemplate($stateParams.templateId);
            $("a[name='org.santedb.emr.widget.patient.act']").click();

            // For effect, scroll to entry after 500 ms
            setTimeout(function () {
                $('html,body').animate({
                    scrollTop: $("#actEntryDiv").offset().top - 230
                },
                    'fast');
            }, 500);

        }
    });

    /**
     * @summary Cascades indicated properties from the holder act to related acts
     * @param {*} source The source object to cascade
     */
    function cascadeProperties(source) {

        source.tag = source.tag || {};
        source.tag["$cascade:*:*"] = "Location;Authororiginator";
        source.relationship = source.relationship || {};
        
        var cascadeInstructions = Object.keys(source.tag).filter(o => o.indexOf("$cascade:") == 0);

        cascadeInstructions.forEach(function (instruction) {
            var targetTemplate = instruction.split(':');
            var cascadeInstructions = source.tag[instruction].split(';');

            if (targetTemplate.length != 3) {
                console.error("Cascade control tag should be in format: $cascade:RelationshipType:template-id");
                return;
            }
            // Find the participation with that template
            if (targetTemplate[1] == "*") {
                searchRelationship = Object.keys(source.relationship).map(key => source.relationship[key]).flat();
            }
            else {
                var searchRelationship = source.relationship[targetTemplate[1]];
                if (searchRelationship == null) {
                    console.warn("Cannot find indicated path", targetTemplate[1]);
                    return;
                }
            }

            // Find the object with the specified template
            if (!Array.isArray(searchRelationship))
                searchRelationship = [searchRelationship];

            searchRelationship
                .filter(o => o.targetModel != null && o.targetModel.templateModel != null && (o.targetModel.templateModel.mnemonic == targetTemplate[2] || targetTemplate[2] == "*"))
                .forEach(function (relationship) {

                    if (!relationship.targetModel.participation)
                        relationship.targetModel.participation = {};

                    cascadeInstructions.map(function (instruction) {
                        var data = instruction.split('=');
                        if (data.length == 1)
                            return { sourceRole: data[0], targetRole: data[0] };
                        else if (data.length == 2)
                            return { sourceRole: data[1], targetRole: data[0] };
                    })
                        .forEach(function (instruction) {
                            if (!relationship.targetModel.participation[instruction.targetRole]) // Only cascade if not specified
                                relationship.targetModel.participation[instruction.targetRole] = source.participation[instruction.sourceRole];
                        });

                });
        });

        return source;
    }

    /**
     * @summary Creates a submission bundle from the related acts and participations
     * @param {*} source The source act to create the submission bundle from
     * @return {Bundle} The bundle to be submitted
     */
    function createSubmissionBundle(source) {

        // Bundle return
        var retVal = new Bundle({ resource: [] });
        retVal.resource.unshift(source);

         // Attach any additional information?
         if(source.tag && source.tag.$attach) {
            source.tag.$attach.split(';').forEach(function(att) {
                var attResource = source.participation[att];
                if(!Array.isArray(attResource))
                    attResource = [ attResource ];
                
                attResource.forEach(function(ptcpt) {
                    if(ptcpt && ptcpt.playerModel) {
                        retVal.resource.unshift(ptcpt.playerModel);
                        ptcpt.player = ptcpt.playerModel.id;
                        delete(ptcpt.playerModel);
                    }
                })
                
            });
        }


        // Participations need to be added
        if (source.participation) {
            Object.keys(source.participation)
                .forEach(function (role) {
                    var participations = source.participation[role];
                    if (!Array.isArray(participations))
                        participations = [participations];

                    // Now we want to add player model to the bundle and generate a key if needed
                    participations.filter(o => o.playerModel || o.actModel).forEach(function (ptcpt) {

                        if (ptcpt.playerModel) // Generate ID 
                        {
                            if (!ptcpt.playerModel.id || ptcpt.player != ptcpt.playerModel.id) // can submit
                            {
                                ptcpt.playerModel.id = ptcpt.playerModel.id || SanteDB.application.newGuid();
                                ptcpt.player = ptcpt.playerModel.id;
                                retVal.resource.unshift(ptcpt.playerModel);
                            }
                        }
                        else  // inverse 
                        {
                            ptcpt.actModel.id = ptcpt.actModel.id || SanteDB.application.newGuid();
                            ptcpt.act = ptcpt.actModel.id;
                            createSubmissionBundle(ptcpt.actModel).resource.forEach((o) => retVal.resource.unshift(o));
                        }

                        delete (ptcpt.playerModel);
                        delete (ptcpt.actModel);
                    });
                });
        }

        // Relationships if active and if they have targetModel
        if (source.relationship) {
            Object.keys(source.relationship)
                .forEach(function (role) {
                    var relationships = source.relationship[role];
                    if (!Array.isArray(relationships))
                        relationships = [relationships];

                    // Now we want to add player model to the bundle and generate a key if needed
                    source.relationship[role] = relationships.filter(o => o._active || o.targetModel && o.targetModel._active || o.holderModel && o.holderModel._active).map(function (rel) {
                        if (rel.targetModel) // Generate ID
                        {
                            rel.targetModel.id = rel.targetModel.id || SanteDB.application.newGuid();
                            rel.target = rel.targetModel.id;
                            createSubmissionBundle(rel.targetModel).resource.forEach((o) => retVal.resource.unshift(o));
                        }
                        else {
                            rel.holderModel.id = rel.holderModel.id || SanteDB.application.newGuid();
                            rel.holder = rel.holderModel.id;
                            createSubmissionBundle(rel.holderModel).resource.forEach((o) => retVal.resource.unshift(o));
                        }
                        // Set ID and add to bundle
                        delete (rel.targetModel);
                        delete (rel.holderModel);

                        return rel;
                    });
                });
        }

        return retVal;
    }

    /**
     * @summary Scrubs an object from Model 
     * @param {*} source The object from which the Model properties should be scrubbed
     * @returns {Array} The model objects which were scrubbed
     */
    function scrubModelProperties(source) {

        if (!Array.isArray(source))
            source = [source];

        source.forEach(function (object) {
            Object.keys(object).forEach(function (key) {
                var rawValue = object[key];

                if (!Array.isArray(rawValue))
                    rawValue = [rawValue];

                rawValue.forEach(function (value) {
                    if (value && key.endsWith("Model")) {


                        // Get the key property
                        var keyProperty = key.substring(0, key.length - 5);
                        var keyValue = object[keyProperty];

                        // Set the key property to the selected / item value if present
                        if (value.id) {
                            object[keyProperty] = value.id;
                            // Remove the detail object
                            delete (object[key]);
                        }
                    }

                    // Scan down 
                    if (value && typeof (value) == "object" && !(value instanceof Date))
                        scrubModelProperties(value);
                });
            });

        });
        return source;
    }

    /**
     * @summary Sets the template of the act and creates the necessary data
     * @param {*} templateId The id of the template which should be loaded
     */
    async function setTemplate(templateId) {
        try {
            var tplContext = $scope.act.$templateContext;
            var noTpl = $scope.act.$noTemplate;
            if (_templates.length == 0)
                _templates = await SanteDB.application.getTemplateDefinitionsAsync();
            $scope.act = await SanteDB.application.getTemplateContentAsync(templateId, {
                "recordTargetId": $stateParams.patientId || $stateParams.id
            });
            $scope.act.$templateUrl = _templates.find(o => o.mnemonic == templateId).form;
            $scope.act.$templateRef = templateId;
            $scope.act.$templateContext = tplContext;
            $scope.act.$noTemplate = noTpl;
            if ($scope.act.participation.RecordTarget) {
                $scope.act.participation.RecordTarget[0].playerModel = $scope.editObject = angular.copy($scope.scopedObject);
            }
        }
        catch (e) {
            $rootScope.errorHandler(e);
        }
        finally {
            $scope.loading = false;
            try { $scope.$apply(); }
            catch (e) { }
        }
    }

    // Watch the template for change
    $scope.$watch("act.$templateRef", function (n, o) {
        if (n && n != o) {
            $scope.loading = true;
            setTemplate(n);
        }
    })

    // Resolve template form
    $scope.resolveTemplateForm = function (templateId) {
        var candidate = _templates.find(o => o.mnemonic == templateId);
        if (candidate)
            return candidate.form;
    }

    // Cancel the entry of data
    $scope.cancelEntry = function () {
        var tplContext = $scope.act.$templateContext;
        $scope.act = {};
        $scope.act.$templateContext = tplContext;
    }

    // Save the act
    $scope.saveAct = async function (form) {
        if (form.$invalid)
            return;

        SanteDB.display.buttonWait("#btnSave", true);
        try {

            var act = angular.copy($scope.act);
            act = cascadeProperties(act);
            // First, we want to scrub the model of any Model objects 
            var submission = createSubmissionBundle(act);

            
            submission.resource = scrubModelProperties(submission.resource);
            submission.resource.forEach(o=>!o.actTime || o.actTime.getYear()  == -1900 ? act.actTime : o.actTime);

           
            submission = await SanteDB.resources.bundle.insertAsync(submission);
            var pscope = $scope;
            while (pscope.$parent.scopedObject)
                pscope = pscope.$parent;
            pscope.scopedObject = await SanteDB.resources.patient.getAsync($scope.scopedObject.id, "full"); // re-fetch the patient
            pscope.editObject = angular.copy(pscope.scopedObject);
            toastr.success(SanteDB.locale.getString("ui.model.act.saveSuccess"));
            $state.transitionTo("santedb-emr.patient.view", { id: $stateParams.id });
        }
        catch (e) {
            $rootScope.errorHandler(e);
        }
        finally {
            SanteDB.display.buttonWait("#btnSave", false);
        }
    }
}]);