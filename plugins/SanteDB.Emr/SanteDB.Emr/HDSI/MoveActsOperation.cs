using DocumentFormat.OpenXml.Presentation;
using DynamicExpresso;
using SanteDB;
using SanteDB.Core.Diagnostics;
using SanteDB.Core.i18n;
using SanteDB.Core.Interop;
using SanteDB.Core.Model;
using SanteDB.Core.Model.Acts;
using SanteDB.Core.Model.Collection;
using SanteDB.Core.Model.Constants;
using SanteDB.Core.Model.Parameters;
using SanteDB.Core.Model.Roles;
using SanteDB.Core.Security;
using SanteDB.Core.Services;
using SanteDB.Rest.Common;
using SanteDB.Rest.Common.Attributes;
using SixLabors.ImageSharp.Processing.Processors.Binarization;
using System;
using System.Collections.Generic;
using System.Collections.Specialized;
using System.Linq;
using System.Text;

namespace SanteEMR.HDSI
{
    /// <summary>
    /// Move acts from their current target to a new patient
    /// </summary>
    public class MoveActsOperation : IApiChildOperation
    {

        // Tracer
        private readonly Tracer m_tracer = Tracer.GetTracer(typeof(MoveActsOperation));
        private readonly IDataPersistenceService<ActParticipation> m_actParticipationService;
        private readonly IDataPersistenceService<ActRelationship> m_actRelationshipPersistence;
        private readonly IRepositoryService<Bundle> m_bundleRepositoryService;
        private readonly IDataPersistenceService<Patient> m_patientPersistenceService;
        private readonly IDataPersistenceService<Act> m_actPersistenceService;
        private readonly Guid?[] m_statusObservationTypes;

        /// <summary>
        /// Patient parameter
        /// </summary>
        public const string PARAMETER_NAME_TO_PATIENT = "toPatient";
        /// <summary>
        /// Acts to be moved
        /// </summary>
        public const string PARAMETER_NAME_ACTS_TO_BE_MOVED = "acts";

        /// <summary>
        /// DI Constructor
        /// </summary>
        public MoveActsOperation(
            IDataPersistenceService<ActParticipation> actParticipationPersistence,
            IDataPersistenceService<ActRelationship> actRelationshipPersistence,
            IDataPersistenceService<Patient> patientPersistenceService,
            IDataPersistenceService<Act> actPersistenceService,
            IRepositoryService<Bundle> bundleRepositoryService,
            IConceptRepositoryService conceptRepository)
        {
            this.m_actParticipationService = actParticipationPersistence;
            this.m_actRelationshipPersistence = actRelationshipPersistence;
            this.m_bundleRepositoryService = bundleRepositoryService;
            this.m_patientPersistenceService = patientPersistenceService;
            this.m_actPersistenceService = actPersistenceService;
            this.m_statusObservationTypes = conceptRepository.ExpandConceptSet(EmrConstants.PatientStatusObservation).Select(o => o.Key).Union(
                conceptRepository.ExpandConceptSet(EmrConstants.EmrConditionTrigger).Select(o => o.Key)).ToArray();
        }
        /// <inheritdoc/>
        public string Name => "emr-change-rct";

        /// <inheritdoc/>
        public ChildObjectScopeBinding ScopeBinding => ChildObjectScopeBinding.Class;

        /// <inheritdoc/>
        public Type[] ParentTypes => new Type[] { typeof(Act) };

        /// <inheritdoc/>
        [Demand(PermissionPolicyIdentifiers.WriteClinicalData)]
        public object Invoke(Type scopingType, object scopingKey, ParameterCollection parameters)
        {
            if (!parameters.TryGet(PARAMETER_NAME_TO_PATIENT, out string patientIdStr) ||
                !Guid.TryParse(patientIdStr, out var patientId))
            {
                throw new ArgumentOutOfRangeException(PARAMETER_NAME_TO_PATIENT);
            }
            else if (this.m_patientPersistenceService.Get(patientId, null, AuthenticationContext.SystemPrincipal) == null)
            {
                throw new KeyNotFoundException(String.Format(ErrorMessages.OBJECT_NOT_FOUND, patientId));
            }
            if (!parameters.TryGet(PARAMETER_NAME_ACTS_TO_BE_MOVED, out string[] actIdStrs))
            {
                throw new ArgumentNullException(PARAMETER_NAME_ACTS_TO_BE_MOVED);
            }
            var actIdGuids = actIdStrs.Select(o => Guid.Parse(o)).ToArray();

            try
            {
                // Max 5 levels deep
                int oldCount = 0, n = 0;
                while (oldCount != actIdGuids.Length && n++ < 5)
                {
                    oldCount = actIdGuids.Length;
                    actIdGuids = actIdGuids.Union(m_actRelationshipPersistence.Query(o => !actIdGuids.Contains(o.TargetActKey.Value) &&
                        actIdGuids.Contains(o.SourceEntityKey.Value) &&
                        o.RelationshipTypeKey == ActRelationshipTypeKeys.HasComponent,
                        AuthenticationContext.SystemPrincipal
                    ).Select(o => o.TargetActKey.Value)).ToArray();
                }

                // Fetch the acts to be moved 
                var oldParticipations = actIdGuids
                    .Select(o => this.m_actParticipationService.Query(c => c.ActKey == o && c.ParticipationRoleKey == ActParticipationKeys.RecordTarget, AuthenticationContext.SystemPrincipal).FirstOrDefault())
                    .OfType<ActParticipation>()
                    .Select(o =>
                    {
                        o.BatchOperation = SanteDB.Core.Model.DataTypes.BatchOperationType.Delete;
                        return o;
                    })
                    .ToList();
                var newParticipations = oldParticipations.Select(o => new ActParticipation()
                {
                    ActKey = o.ActKey,
                    BatchOperation = SanteDB.Core.Model.DataTypes.BatchOperationType.Insert,
                    ClassificationKey = o.ClassificationKey,
                    EffectiveVersionSequenceId = o.EffectiveVersionSequenceId,
                    ParticipationRoleKey = o.ParticipationRoleKey,
                    PlayerEntityKey = patientId,
                    Quantity = o.Quantity
                }).ToList();

                // Fetch any status observations and ensure that we load those so the BRE can interface with those
                var conditionActs = (
                    this.m_actPersistenceService.Query(o => this.m_statusObservationTypes.Contains(o.TypeConceptKey) &&
                            actIdGuids.Contains(o.Key.Value), AuthenticationContext.SystemPrincipal)
                        .ToArray()
                        .Select(act =>
                        {
                            act.LoadProperty(o => o.Participations).RemoveAll(o => o.ParticipationRoleKey == ActParticipationKeys.RecordTarget); // Ignore any participations since we want to preserve them
                            act.Relationships = null; // Ignore any relationships since we want to preserve them
                            act.Participations.Add(new ActParticipation()
                            {
                                PlayerEntityKey = patientId,
                                ParticipationRoleKey = ActParticipationKeys.RecordTarget
                            });
                            newParticipations.RemoveAll(o => o.ActKey == act.Key);
                            oldParticipations.RemoveAll(o => o.ActKey == act.Key);
                            act.BatchOperation = SanteDB.Core.Model.DataTypes.BatchOperationType.InsertOrUpdate;
                            act.RemoveTag(EmrConstants.IgnoreEmrTriggersTagName);
                            return act;
                        })
                ).ToList();

                // Fetch any status observations and ensure that we load those so the BRE can interface with those
                var batch = new Bundle(oldParticipations.OfType<IdentifiedData>().Union(newParticipations).Union(conditionActs));
                this.m_tracer.TraceInfo("Will migrate '{0}' to patient '{1}' - inserting {2} items in batch", String.Join(",", oldParticipations.Select(o => o.Key), patientId, batch.Item.Count));
                this.m_bundleRepositoryService.Insert(batch);
                return null;
            }
            catch (Exception ex)
            {
                this.m_tracer.TraceError("Error migrating '{0}' to patient '{1}' - {2}", String.Join(",", actIdStrs), patientId, ex.ToHumanReadableString());
                throw new Exception(String.Format(ErrorMessages.DELETE_ERROR, String.Join(",", actIdStrs)), ex);
            }
        }
    }
}
