/// <Reference path="../../../.ref/js/santedb.js" />
/// <Reference path="../../../.ref/js/santedb-model.js" />
/// <Reference path="../../../../user/js/emr.js" />
angular.module("santedb").controller("EmrAllergyController", ["$scope", "$rootScope", "$timeout", function ($scope, $rootScope, $timeout) {

    const _INTOLERANCETYPES = [
        "d0962d26-2230-41fd-a67c-02ce905c5d1f",
        "0124fde0-7857-4815-b257-74acaa0dd92d",
        "9cafb9ec-cd0b-4003-b30c-677fa39b2e16",
        "298ac8e5-84ba-4992-9eec-892c636c8e73",
        "62fc0be4-f75f-460b-ab98-4215f4573748",
        "0577d51f-8ff5-4cf7-a2dd-bfc52841fff2",
        "594f0a36-34c1-48b4-b870-883173450ff4"
    ];

    const _ALLERGYTYPES = [
        "d001f69c-118c-4080-a675-51be0ec51f86",
        "86b79688-2440-419f-9776-e088b380b7a2",
        "c71b35e1-7709-4cc3-a2d5-a105a4085a50",
        "353f73b8-43d9-4b02-8c76-5d7e76301bae"
    ];

    const _SETTYPEMAP = [
        { type: 'd001f69c-118c-4080-a675-51be0ec51f86', value: '0b47d71e-ee68-11f0-8ed8-3be493caedb2' },
        { type: 'd0962d26-2230-41fd-a67c-02ce905c5d1f', value: '0b47d71e-ee68-11f0-8ed8-3be493caedb2' },
        { type: '86b79688-2440-419f-9776-e088b380b7a2', value: '95adad16-ee63-11f0-b880-473a6773217a' },
        { type: '0124fde0-7857-4815-b257-74acaa0dd92d', value: '95adad16-ee63-11f0-b880-473a6773217a' },
        { type: '62fc0be4-f75f-460b-ab98-4215f4573748', value: '95adad16-ee63-11f0-b880-473a6773217a' },
        { type: 'c71b35e1-7709-4cc3-a2d5-a105a4085a50', value: 'c7fde722-ee63-11f0-b881-87f56c98c33c' },
        { type: '0577d51f-8ff5-4cf7-a2dd-bfc52841fff2', value: 'c7fde722-ee63-11f0-b881-87f56c98c33c' },
        { type: '9cafb9ec-cd0b-4003-b30c-677fa39b2e16', value: 'c7fde722-ee63-11f0-b881-87f56c98c33c' },
        { type: '353f73b8-43d9-4b02-8c76-5d7e76301bae', value: 'b0a6517c-ee63-11f0-9845-bb9c635e6df3' },
        { type: '298ac8e5-84ba-4992-9eec-892c636c8e73', value: 'b0a6517c-ee63-11f0-9845-bb9c635e6df3' },
        { type: '594f0a36-34c1-48b4-b870-883173450ff4', value: 'b0a6517c-ee63-11f0-9845-bb9c635e6df3' }
    ];

    async function getOrCreatePanel(rct) {
        try {
            var panel = await SanteDB.resources.act.findAsync(
                {
                    "participation[RecordTarget].player": rct,
                    "typeConcept": "05209d66-1500-488a-a32f-c4b0ce2e3051",
                    "statusConcept": StatusKeys.Completed,
                    "_count": 1,
                    "_includeTotal": false
                },
                "min"
            );

            var isNew = !panel.resource;
            if (panel.resource) {
                panel = { id: panel.resource[0].id };
            }
            else {

                // Otherwise grab the STI template and create it for the record target
                panel = await SanteDB.application.getTemplateContentAsync("org.santedb.emr.problem.allergyIntolerance.panel", {
                    recordTargetId: rct,
                    userEntityId: await SanteDB.authentication.getCurrentUserEntityId()
                }, "min");
                delete (panel.relationship.HasComponent); // delete the default has component
            }

            $scope.act.relationship = $scope.act.relationship || {};
            $scope.act.relationship.HasComponent = $scope.act.relationship.HasComponent || [];
            $scope.act.relationship.HasComponent.push({
                source: panel.id,
                sourceModel: isNew ? panel : false,
                $insertFirst: true
            });

        }
        catch (e) {
            console.warn("Error assigning allergy panel");
        }
    }

    function setupWatchOnAllergy(rct) {
        $scope.$watch("act.typeConcept", function (n, o) {
            if (n && n != o) {
                $scope.act._conceptSet = _SETTYPEMAP.find(o => o.type == n).value;
            }
        });

        $scope.$watch("act.value", async function (n, o) {
            if (n && n != o) {

                try {
                    // Select the appropriate type of allergy
                    const concept = await SanteDB.resources.concept.getAsync(n, "min");

                    
                    $timeout(() => {
                        var types = _SETTYPEMAP.filter(o => concept.conceptSet?.includes(o.value))?.map(o => o.type);

                        if(types.length == 0) return;
                        if (concept.mnemonic.indexOf('Allergy') > -1) {
                            types = types.filter(o => _ALLERGYTYPES.includes(o));
                        }
                        else if (concept.mnemonic.indexOf("Intoler") > -1) {
                            types = types.filter(o => _INTOLERANCETYPES.includes(o));
                        }

                        if (!types.includes($scope.act.typeConcept)) {
                            $scope.act.typeConcept = types[0];
                        }
                    });

                    // Check fo duplication
                    var existing = await SanteDB.resources.codedObservation.findAsync({
                        "typeConcept": $scope.act.typeConcept,
                        "value": n,
                        "participation[RecordTarget].player": rct,
                        "relationship[RefersTo].source@CodedObservation.participation[RecordTarget].player": rct,
                        "relationship[RefersTo].source@CodedObservation.typeConcept": "236b5641-61d2-4d12-91f7-5dddbd7f8931",
                        "relationship[RefersTo].source@CodedObservation.statusConcept": StatusKeys.Active,
                        "_count": 1,
                        "_includeTotal": false
                    }, "min");

                    $timeout(() => {
                        $rootScope.getParentVariable($scope, ['ownerForm', 'editForm', 'panel.editForm'])['allergy' + $scope.act.id + "Value"]?.$setValidity("duplicate", !(existing.resource && existing.resource[0].id != $scope.act.id));
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
                case "a18674f4-38bf-40aa-a2ba-252d894dc64b": // Panel
                    $scope.act.statusConcept = StatusKeys.Completed;
                    break;
                case "908674f4-38bf-40aa-a2ba-252d894dc64b": // Infection - we need to make sure this is part of a panel
                    var rct = $scope.act.participation?.RecordTarget[0]?.player;
                    if (rct) {
                        if ($scope.act.tag?.$userAdded) {
                            getOrCreatePanel(rct);
                        }
                        setupWatchOnAllergy(rct);
                    }
                    break;
            }
        }
    });


    $scope.addAllergyToPanel = async function () {
        try {
            SanteDB.display.buttonWait("#btnAddAllergy", true);
            var template = await SanteDB.application.getTemplateContentAsync("org.santedb.emr.problem.allergyIntolerance", {
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
            SanteDB.display.buttonWait("#btnAddAllergy", false);
        }
    }

    $scope.addAllergyToPanel = function (comp) {
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

    $scope.addAllergyToPanel = function (comp) {
        comp.targetModel.statusConcept = 'afc33800-8225-4061-b168-bacc09cdbae3';
        comp.operation = 2;
    }
}]);