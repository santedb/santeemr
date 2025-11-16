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
angular.module('santedb').controller('EmrPatientViewWidgetController', ['$scope', '$rootScope', '$timeout', function ($scope, $rootScope, $timeout) {
    $scope.showBarcode = function(barcodeDomain) {
        $scope.bcDomain = barcodeDomain;
        $("#barcodeModal").modal('show');
    }
    // Actually pull 
    $scope.update = async function (form) {
        // TODO: Update the address to the targetAddressId if it is present in the address.
        if (form.$invalid) {
            return false;
        }

        // Now post the changed update object 
        try {            
            var submissionObject = angular.copy($scope.editObject);
            submissionObject = await prepareEntityForSubmission(submissionObject);
            
            // Bundle to be submitted
            var bundle = new Bundle({ resource: [submissionObject] });
            
            await SanteDB.resources.bundle.insertAsync(bundle, undefined, undefined, true);
            var updated = await SanteDB.resources.patient.getAsync($scope.scopedObject.id, "full"); // re-fetch the patient
            $timeout(() => $scope.scopedObject = updated);
            toastr.success(SanteDB.locale.getString("ui.model.patient.saveSuccess"));
            form.$valid = true;
        }
        catch (e) {
            $rootScope.errorHandler(e);
            form.$valid = false;
        }
    };

    // Add identifier
    $scope.addIdentifier = function (id) {
        if (!$scope.panel.editForm.$valid) {
            return;
        } else {
            var authority = id.domainModel.domainName;
            var existing = $scope.editObject.identifier[authority];

            if (!existing) // no identifiers in this domain
                $scope.editObject.identifier[authority] = existing = [];
            else if (!Array.isArray(existing)) // Has only one => turn into array
                $scope.editObject.identifier[authority] = existing = [existing];

            id.id = SanteDB.application.newGuid();
            existing.push(angular.copy(id));
            delete (id.domainModel);
            delete (id.value);
            delete (id.id);
        }
    }

    // Remove identifier
    $scope.removeIdentifier = function (authority, id) {
        if (confirm(SanteDB.locale.getString("ui.model.entity.identifier.authority.remove.confirm"))) {
            var idList = $scope.editObject.identifier[authority];
            if (!Array.isArray(idList))
                idList = [idList];

            // Remove value from specified list
            idList = idList.filter(o => o.value != id);

            // Any items
            if (idList.length == 0)
                delete ($scope.editObject.identifier[authority]);
            else
                $scope.editObject.identifier[authority] = idList;
        }
    }

    $scope.$watch("panel.view", async function(n, o) {   
        if (n == 'Edit') {
            if ($scope.editObject) {
                $scope.editObject.multipleBirthIndicator = !!$scope.editObject.multipleBirthOrder;
                
                if ($scope.editObject.extension) {
                    $scope.isBirthValidated = $scope.editObject.extension['http://santedb.org/extensions/core/birthValidated']?.[0] == BooleanExtensionValues.true;
                }
                else {
                    $scope.editObject.extension = {
                        'http://santedb.org/extensions/core/birthValidated': [ BooleanExtensionValues.false ]
                    }
                }

                $scope.editObject.age = dateToAge($scope.editObject.dateOfBirth)
            }
        }
    });

    // Watch will look for scoped object to load and will set necessary shortcut objects for the view 
    $scope.$watch("scopedObject", async function (n, o) {
        if (n && n != null) {
            delete ($scope.editObject); // Delete the current edit object
            $scope.editObject = angular.copy(n);
            
            // if ($scope.editObject.address['HomeAddress'][0].component['PlaceRef']) {
            //     delete $scope.editObject.address['HomeAddress'][0].component['PlaceRef']
            // }
            
            if (!$scope.editObject.address?.['TemporaryAddress']) {
                $scope.editObject.address['TemporaryAddress'] = [
                    {
                        "component": {
                            "$other": []
                        },
                        "use": AddressUseKeys.TemporaryAddress,
                        "useModel": {
                            "id": AddressUseKeys.TemporaryAddress,
                            "mnemonic": "TemporaryAddress"
                        }
                    }
                ];
            }

            // Correct identifiers to all be arrays
            if (n.identifier)
                Object.keys(n.identifier).forEach(function (key) {
                    if (!Array.isArray(n.identifier[key]))
                        n.identifier[key] = [n.identifier[key]];

                    n.identifier[key].forEach(function (id) {
                        id._codeUrl = `/hdsi/Patient/${n.id}/_code?_format=santedb-vrp`;
                    })
                });
        }
    });

    /**
     * Convert the specified person (reclass it) to a full patient
     */
    $scope.convertToPatient = async function (personToConvert) {

        if (!personToConvert.$converting)
            personToConvert.$converting = true;
        else if (confirm(SanteDB.locale.getString("ui.model.reclass.confirm"))) {
            try {
                var patient = new Patient(personToConvert);

                patient.tag = patient.tag || {};
                patient.classConcept = EntityClassKeys.Patient;
                delete (patient.classConceptModel);
                patient.tag["$sys.reclass"] = "true";

                var updatedPerson = await SanteDB.resources.patient.updateAsync(personToConvert.id, patient);
                personToConvert.$type = "Patient";
            }
            catch (e) {
                $rootScope.errorHandler(e);
            }
        }
    }


}]);
