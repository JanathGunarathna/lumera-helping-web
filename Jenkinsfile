pipeline {
    agent any

    options {
        timestamps()
        disableConcurrentBuilds()
    }

    stages {

        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Install Dependencies') {
            steps {
                sh 'npm install'
            }
        }

        stage('Write Environment File') {
            steps {
                // Scoped to this stage only — the agent/workspace is already
                // allocated by this point, so a missing credential fails
                // just this stage with a clear message instead of breaking
                // the whole pipeline before it properly started.
                withCredentials([
                    string(credentialsId: 'vite-firebase-api-key',             variable: 'VITE_FIREBASE_API_KEY'),
                    string(credentialsId: 'vite-firebase-auth-domain',         variable: 'VITE_FIREBASE_AUTH_DOMAIN'),
                    string(credentialsId: 'vite-firebase-project-id',          variable: 'VITE_FIREBASE_PROJECT_ID'),
                    string(credentialsId: 'vite-firebase-storage-bucket',      variable: 'VITE_FIREBASE_STORAGE_BUCKET'),
                    string(credentialsId: 'vite-firebase-messaging-sender-id', variable: 'VITE_FIREBASE_MESSAGING_SENDER_ID'),
                    string(credentialsId: 'vite-firebase-app-id',              variable: 'VITE_FIREBASE_APP_ID')
                ]) {
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
                withCredentials([string(credentialsId: 'firebase-token', variable: 'FIREBASE_TOKEN')]) {
                    sh 'npx firebase-tools deploy --only hosting --token "$FIREBASE_TOKEN" --non-interactive'
                }
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
            // returnStatus so a missing workspace/file never throws a
            // second, unrelated-looking error on top of a real failure.
            sh(script: 'rm -f .env', returnStatus: true)
        }
    }
}