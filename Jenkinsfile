pipeline {
    agent any

    options {
        timestamps()
        disableConcurrentBuilds()
    }

    environment {
        NODE_IMAGE = 'node:20-alpine'
    }

    stages {

        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Write Environment File') {
            steps {
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

        stage('Install Dependencies') {
            steps {
                script {
                    docker.image(env.NODE_IMAGE).inside {
                        sh 'npm install'
                    }
                }
            }
        }

        stage('Build') {
            steps {
                script {
                    docker.image(env.NODE_IMAGE).inside {
                        sh 'npm run build'
                    }
                }
            }
        }

        stage('Deploy to Firebase Hosting') {
            when {
                branch 'main'
            }
            steps {
                withCredentials([string(credentialsId: 'firebase-token', variable: 'FIREBASE_TOKEN')]) {
                    script {
                        docker.image(env.NODE_IMAGE).inside {
                            sh 'npx firebase-tools deploy --only hosting --token "$FIREBASE_TOKEN" --non-interactive'
                        }
                    }
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
            sh(script: 'rm -f .env', returnStatus: true)
        }
    }
}