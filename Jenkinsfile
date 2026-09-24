pipeline {
    agent any

    options {
        timestamps()
        disableConcurrentBuilds()
    }

    environment {
        // Jenkins credential IDs — create these in
        // Manage Jenkins > Credentials before running.
        FIREBASE_TOKEN                    = credentials('firebase-token')
        VITE_FIREBASE_API_KEY             = credentials('vite-firebase-api-key')
        VITE_FIREBASE_AUTH_DOMAIN         = credentials('vite-firebase-auth-domain')
        VITE_FIREBASE_PROJECT_ID          = credentials('vite-firebase-project-id')
        VITE_FIREBASE_STORAGE_BUCKET      = credentials('vite-firebase-storage-bucket')
        VITE_FIREBASE_MESSAGING_SENDER_ID = credentials('vite-firebase-messaging-sender-id')
        VITE_FIREBASE_APP_ID              = credentials('vite-firebase-app-id')
    }

    stages {

        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Install Dependencies') {
            steps {
                sh 'npm ci'
            }
        }

        stage('Write Environment File') {
            steps {
                // Vite only reads .env at build time, so it has to exist
                // before "npm run build" runs. Never echo these values.
                sh '''
                  cat > .env <<EOF
VITE_FIREBASE_API_KEY=$VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN=$VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID=$VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET=$VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID=$VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID=$VITE_FIREBASE_APP_ID
EOF
                '''
            }
        }

        stage('Build') {
            steps {
                sh 'npm run build'
            }
        }

        stage('Deploy to Firebase Hosting') {
            when {
                branch 'main' // change to your deploy branch, e.g. 'master'
            }
            steps {
                sh 'npx firebase-tools deploy --only hosting --token "$FIREBASE_TOKEN" --non-interactive'
            }
        }
    }

    post {
        success {
            echo 'Build and deploy finished successfully.'
        }
        failure {
            echo 'Pipeline failed — check the failing stage log above.'
        }
        always {
            // Never leave real keys sitting on the agent's disk.
            sh 'rm -f .env'
        }
    }
}