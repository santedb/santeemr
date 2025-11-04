using SanteDB.Client.Configuration;
using SanteDB.Core.Configuration.Data;
using SanteDB.Core.Diagnostics;
using SanteDB.Core.Services;
using SanteDB.Core;
using SanteEMR.Rules;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using SanteDB.Core.Model.Acts;
using SanteDB.Core.Model.Roles;
using SanteDB.Core.Model.Collection;

namespace SanteEMR.Services
{
    /// <summary>
    /// Daemon service which initializes the EMR services
    /// </summary>
    public class EmrInitializationDaemon : IDaemonService
    {

        private readonly Tracer m_tracer = Tracer.GetTracer(typeof(EmrInitializationDaemon));
        private readonly IServiceProvider m_serviceProvider;
        private readonly bool m_shouldBindServices;

        /// <summary>
        /// DI constructor
        /// </summary>
        public EmrInitializationDaemon(IServiceProvider serviceProvider, IConfigurationManager configurationManager)
        {
            this.m_serviceProvider = serviceProvider;
            this.m_shouldBindServices = (!(configurationManager is InitialConfigurationManager)) &&
                configurationManager.GetSection<DataConfigurationSection>()?.ConnectionString?.Any() == true;
            this.m_tracer.TraceWarning("--- This service will use SanteEMR Functions, if this is not intended, please remove the EmrDaemon ---");
        }

        /// <inheritdoc/>
        public bool IsRunning => true;

        /// <inheritdoc/>
        public string ServiceName => "SanteEMR Service Daemon";

        /// <inheritdoc/>
        public event EventHandler Starting;
        /// <inheritdoc/>
        public event EventHandler Started;
        /// <inheritdoc/>
        public event EventHandler Stopping;
        /// <inheritdoc/>
        public event EventHandler Stopped;

        /// <inheritdoc/>
        public bool Start()
        {
            this.Starting?.Invoke(this, EventArgs.Empty);

            if(this.m_shouldBindServices)
            {
                this.m_tracer.TraceInfo("Binding EMR Service Events");
                this.m_serviceProvider.AddBusinessRule<Bundle>(typeof(BundleTagConfidentialRule));
                this.m_serviceProvider.AddBusinessRule<Bundle>(typeof(BundleStatusObservationRule));
            }
            
            this.Started?.Invoke(this, EventArgs.Empty);
            return true;
        }

        /// <inheritdoc/>
        public bool Stop()
        {
            this.Stopping?.Invoke(this, EventArgs.Empty);

            this.Stopped?.Invoke(this, EventArgs.Empty);
            return true;
        }
    }
}
